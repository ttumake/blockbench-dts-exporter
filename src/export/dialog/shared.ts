import type { ExportConfig } from '../config';
import { DEFAULT_EXPORT_CONFIG } from '../config';
import type {
  BuiltExportMaterialInfo,
  BuiltExportPackage
} from '../package';

export type ExportDialogResult = {
  config: ExportConfig;
  packageData: BuiltExportPackage;
};

export type ConfirmCallback = (result: ExportDialogResult) => void;

export type MaterialOverrideMap = ExportConfig['materialOverrides'];

export type TabId = 'general' | 'materials' | 'sequences' | 'lods' | 'help';

export type DialogState = {
  dtsVersion: ExportConfig['dtsVersion'];
  mode: ExportConfig['mode'];
  exportAnimations: boolean;
  enabledSequences: ExportConfig['enabledSequences'];
  orientation: ExportConfig['orientation'];
  scale: number;
  textureProcessing: ExportConfig['textureProcessing'];
  materialFlags: ExportConfig['materialFlags'];
};

export function createSectionNode(): HTMLDivElement {
  const node = document.createElement('div');
  node.style.display = 'grid';
  node.style.gap = '10px';
  return node;
}

export function createCardNode(): HTMLDivElement {
  const node = document.createElement('div');
  node.style.padding = '10px 12px';
  node.style.background = 'var(--color-back)';
  node.style.borderRadius = '6px';
  node.style.border = '1px solid color-mix(in srgb, var(--color-border, #000) 60%, transparent)';
  return node;
}

export function createTextNode(text = ''): HTMLDivElement {
  const node = document.createElement('div');
  node.textContent = text;
  node.style.whiteSpace = 'pre-wrap';
  node.style.lineHeight = '1.45';
  node.style.fontSize = '12px';
  return node;
}

export function createCodeNode(text = ''): HTMLDivElement {
  const node = createTextNode(text);
  node.style.fontFamily = 'monospace';
  return node;
}

export function createStatsGrid(): HTMLDivElement {
  const node = document.createElement('div');
  node.style.display = 'grid';
  node.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
  node.style.gap = '8px';
  return node;
}

export function createControlLabel(text: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.style.display = 'grid';
  label.style.gap = '4px';
  label.style.fontSize = '12px';
  label.textContent = text;
  return label;
}

export function createSwatch(material: Pick<BuiltExportMaterialInfo, 'previewDataUrl' | 'name'>): HTMLImageElement {
  const image = document.createElement('img');
  image.src = material.previewDataUrl;
  image.alt = material.name;
  image.width = 24;
  image.height = 24;
  image.style.width = '24px';
  image.style.height = '24px';
  image.style.imageRendering = 'pixelated';
  image.style.borderRadius = '4px';
  image.style.border = '1px solid var(--color-border, #444)';
  image.style.background = 'linear-gradient(45deg, #aaa 25%, #888 25%, #888 50%, #aaa 50%, #aaa 75%, #888 75%, #888 100%)';
  image.style.backgroundSize = '8px 8px';
  return image;
}

export function cloneMaterialOverrides(overrides: MaterialOverrideMap): MaterialOverrideMap {
  const clone: MaterialOverrideMap = {};

  for (const [name, value] of Object.entries(overrides)) {
    clone[name] = {
      ...value,
      textureProcessing: value.textureProcessing ? { ...value.textureProcessing } : undefined
    };
  }

  return clone;
}

export function normalizeMaterialOverrides(
  materialNames: string[],
  overrides: MaterialOverrideMap
): MaterialOverrideMap {
  const normalized: MaterialOverrideMap = cloneMaterialOverrides(overrides);

  for (const materialName of materialNames) {
    normalized[materialName] = { ...(normalized[materialName] ?? {}) };
  }

  return normalized;
}

export function readBaseConfig(state: DialogState): Omit<ExportConfig, 'materialOverrides'> {
  return {
    dtsVersion: state.dtsVersion,
    mode: state.mode,
    exportAnimations: state.exportAnimations,
    enabledSequences: { ...state.enabledSequences },
    orientation: state.orientation,
    scale: Number.isFinite(state.scale) && state.scale > 0 ? state.scale : DEFAULT_EXPORT_CONFIG.scale,
    textureProcessing: {
      bleedPasses: Number.isFinite(state.textureProcessing.bleedPasses) && state.textureProcessing.bleedPasses >= 0
        ? Math.round(state.textureProcessing.bleedPasses)
        : DEFAULT_EXPORT_CONFIG.textureProcessing.bleedPasses,
      upscaleTargetSize: Number.isFinite(state.textureProcessing.upscaleTargetSize) && state.textureProcessing.upscaleTargetSize >= 1
        ? Math.round(state.textureProcessing.upscaleTargetSize)
        : DEFAULT_EXPORT_CONFIG.textureProcessing.upscaleTargetSize
    },
    materialFlags: {
      sWrap: state.materialFlags.sWrap,
      tWrap: state.materialFlags.tWrap,
      noMipMap: state.materialFlags.noMipMap,
      mipMapZeroBorder: state.materialFlags.mipMapZeroBorder,
      neverEnvMap: state.materialFlags.neverEnvMap
    }
  };
}

export function buildConfig(state: DialogState, overrides: MaterialOverrideMap): ExportConfig {
  return {
    ...readBaseConfig(state),
    materialOverrides: cloneMaterialOverrides(overrides)
  };
}
