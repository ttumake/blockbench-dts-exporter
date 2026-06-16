import type { ExportConfig } from './config';
import { DEFAULT_EXPORT_CONFIG } from './config';
import { buildExportPackage } from './package';

type ExportDialogResult = {
  config: ExportConfig;
  packageData: ReturnType<typeof buildExportPackage>;
};

type ConfirmCallback = (result: ExportDialogResult) => void;

type MaterialOverrideMap = ExportConfig['materialOverrides'];

function createPreviewNode(): HTMLDivElement {
  const node = document.createElement('div');
  node.style.minHeight = '120px';
  node.style.whiteSpace = 'pre-wrap';
  node.style.fontFamily = 'monospace';
  node.style.fontSize = '12px';
  node.style.lineHeight = '1.4';
  node.style.padding = '8px 10px';
  node.style.background = 'var(--color-back)';
  node.style.borderRadius = '4px';
  return node;
}

function createMaterialListNode(): HTMLDivElement {
  const node = document.createElement('div');
  node.style.display = 'grid';
  node.style.gap = '8px';
  return node;
}

function cloneMaterialOverrides(overrides: MaterialOverrideMap): MaterialOverrideMap {
  const clone: MaterialOverrideMap = {};

  for (const [name, value] of Object.entries(overrides)) {
    clone[name] = { ...value };
  }

  return clone;
}

function normalizeMaterialOverrides(
  materialNames: string[],
  overrides: MaterialOverrideMap
): MaterialOverrideMap {
  const normalized: MaterialOverrideMap = {};

  for (const materialName of materialNames) {
    normalized[materialName] = { ...(overrides[materialName] ?? {}) };
  }

  return normalized;
}

function readBaseConfig(dialog: Dialog): Omit<ExportConfig, 'materialOverrides'> {
  const values = dialog.getFormResult();
  const scale = Number(values.scale);

  return {
    mode: values.mode as ExportConfig['mode'],
    orientation: values.orientation as ExportConfig['orientation'],
    scale: Number.isFinite(scale) && scale > 0 ? scale : DEFAULT_EXPORT_CONFIG.scale,
    materialFlags: {
      sWrap: Boolean(values.s_wrap),
      tWrap: Boolean(values.t_wrap),
      noMipMap: Boolean(values.no_mip_map),
      mipMapZeroBorder: Boolean(values.mip_map_zero_border),
      neverEnvMap: Boolean(values.never_env_map)
    }
  };
}

function buildConfig(dialog: Dialog, overrides: MaterialOverrideMap): ExportConfig {
  return {
    ...readBaseConfig(dialog),
    materialOverrides: cloneMaterialOverrides(overrides)
  };
}

function formatPreview(
  config: ExportConfig,
  packageData: ReturnType<typeof buildExportPackage>
): string {
  const glowingCount = packageData.materialNames.filter(
    (name) => config.materialOverrides[name]?.selfIlluminating
  ).length;

  return [
    `Mode: ${packageData.mode}`,
    `Orientation: ${config.orientation === 'blockland_swap_yz_flip_xz' ? 'Blockland Default' : 'None'}`,
    `Scale: ${config.scale}`,
    `Generated textures: ${packageData.textureCount}`,
    `Glow materials: ${glowingCount}`,
    '',
    'Global material flags:',
    `- sWrap: ${config.materialFlags.sWrap}`,
    `- tWrap: ${config.materialFlags.tWrap}`,
    `- noMipMap: ${config.materialFlags.noMipMap}`,
    `- mipMapZeroBorder: ${config.materialFlags.mipMapZeroBorder}`,
    `- neverEnvMap: ${config.materialFlags.neverEnvMap}`,
    '',
    'Per-material flags:',
    '- Glow is configured below per generated material.'
  ].join('\n');
}

function renderMaterialOverrides(
  materialListNode: HTMLDivElement,
  materialNames: string[],
  overrides: MaterialOverrideMap,
  onChange: () => void
): void {
  materialListNode.replaceChildren();

  if (materialNames.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'No generated materials for this export.';
    empty.style.padding = '8px 10px';
    empty.style.background = 'var(--color-back)';
    empty.style.borderRadius = '4px';
    materialListNode.append(empty);
    return;
  }

  for (const materialName of materialNames) {
    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '12px';
    row.style.padding = '8px 10px';
    row.style.background = 'var(--color-back)';
    row.style.borderRadius = '4px';

    const name = document.createElement('span');
    name.textContent = `${materialName}.png`;
    name.style.fontFamily = 'monospace';
    name.style.fontSize = '12px';

    const glowWrap = document.createElement('span');
    glowWrap.style.display = 'inline-flex';
    glowWrap.style.alignItems = 'center';
    glowWrap.style.gap = '6px';

    const glowLabel = document.createElement('span');
    glowLabel.textContent = 'Glow';

    const glowInput = document.createElement('input');
    glowInput.type = 'checkbox';
    glowInput.checked = Boolean(overrides[materialName]?.selfIlluminating);
    glowInput.addEventListener('change', () => {
      overrides[materialName] = {
        ...(overrides[materialName] ?? {}),
        selfIlluminating: glowInput.checked
      };
      onChange();
    });

    glowWrap.append(glowLabel, glowInput);
    row.append(name, glowWrap);
    materialListNode.append(row);
  }
}

export function showExportDialog(projectName: string, onConfirmExport: ConfirmCallback): Dialog {
  const previewNode = createPreviewNode();
  const materialListNode = createMaterialListNode();
  let currentOverrides = cloneMaterialOverrides(DEFAULT_EXPORT_CONFIG.materialOverrides);
  let currentConfig: ExportConfig = {
    ...DEFAULT_EXPORT_CONFIG,
    materialOverrides: currentOverrides
  };
  let currentPackage = buildExportPackage(projectName, currentConfig);

  const refresh = (dialog: Dialog): void => {
    const baseConfig = readBaseConfig(dialog);
    currentOverrides = normalizeMaterialOverrides(currentPackage.materialNames, currentOverrides);
    currentConfig = {
      ...baseConfig,
      materialOverrides: cloneMaterialOverrides(currentOverrides)
    };
    currentPackage = buildExportPackage(projectName, currentConfig);
    currentOverrides = normalizeMaterialOverrides(currentPackage.materialNames, currentOverrides);
    currentConfig = buildConfig(dialog, currentOverrides);
    previewNode.textContent = formatPreview(currentConfig, currentPackage);
    renderMaterialOverrides(materialListNode, currentPackage.materialNames, currentOverrides, () => {
      refresh(dialog);
    });
  };

  const dialog = new Dialog({
    id: 'dts_export_dialog',
    title: 'Export DTS',
    width: 560,
    buttons: ['Cancel', 'Export'],
    cancelIndex: 0,
    confirmIndex: 1,
    form: {
      mode: {
        label: 'Mode',
        type: 'select',
        value: DEFAULT_EXPORT_CONFIG.mode,
        options: {
          blockland_colors: 'Blockland Colors',
          atlas_textures: 'Atlas Textures'
        }
      },
      orientation: {
        label: 'Orientation',
        type: 'select',
        value: DEFAULT_EXPORT_CONFIG.orientation,
        options: {
          blockland_swap_yz_flip_xz: 'Blockland Default',
          none: 'None'
        }
      },
      scale: {
        label: 'Scale',
        type: 'number',
        value: DEFAULT_EXPORT_CONFIG.scale,
        min: 0.0001,
        step: 0.01
      },
      s_wrap: {
        label: 'S Wrap',
        type: 'checkbox',
        value: DEFAULT_EXPORT_CONFIG.materialFlags.sWrap
      },
      t_wrap: {
        label: 'T Wrap',
        type: 'checkbox',
        value: DEFAULT_EXPORT_CONFIG.materialFlags.tWrap
      },
      no_mip_map: {
        label: 'No MipMap',
        type: 'checkbox',
        value: DEFAULT_EXPORT_CONFIG.materialFlags.noMipMap
      },
      mip_map_zero_border: {
        label: 'Zero Border',
        type: 'checkbox',
        value: DEFAULT_EXPORT_CONFIG.materialFlags.mipMapZeroBorder
      },
      never_env_map: {
        label: 'Never EnvMap',
        type: 'checkbox',
        value: DEFAULT_EXPORT_CONFIG.materialFlags.neverEnvMap
      }
    },
    lines: [
      {
        label: 'Preview',
        node: previewNode
      },
      {
        label: 'Materials',
        node: materialListNode
      }
    ],
    onBuild() {
      refresh(dialog);
    },
    onFormChange() {
      refresh(dialog);
    },
    onConfirm() {
      onConfirmExport({
        config: currentConfig,
        packageData: currentPackage
      });
    }
  });

  return dialog.show();
}
