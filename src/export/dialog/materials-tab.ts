import type {
  BuiltExportMaterialInfo,
  BuiltExportPackage,
  BuiltExportSourceMaterialInfo
} from '../package';
import {
  createCardNode,
  createCodeNode,
  createSectionNode,
  createSwatch,
  createTextNode,
  type DialogState,
  type MaterialOverrideMap
} from './shared';
import { materialsText } from './text';

function openTextureProcessingDialog(
  materialName: string,
  title: string,
  state: DialogState,
  getOverrides: () => MaterialOverrideMap,
  getPackageData: () => BuiltExportPackage,
  onChange: () => void
): void {
  const root = createSectionNode();
  const previewCard = createCardNode();
  previewCard.style.overflow = 'auto';
  const previewWrap = document.createElement('div');
  previewWrap.style.position = 'relative';
  previewWrap.style.width = '100%';
  previewWrap.style.maxWidth = '320px';
  previewWrap.style.display = 'inline-block';
  let previewZoom = 1;

  const preview = document.createElement('img');
  preview.style.width = '100%';
  preview.style.height = 'auto';
  preview.style.display = 'block';
  preview.style.imageRendering = 'pixelated';
  preview.style.borderRadius = '6px';
  preview.style.border = '1px solid var(--color-border, #444)';
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  overlay.setAttribute('viewBox', '0 0 100 100');
  overlay.setAttribute('preserveAspectRatio', 'none');
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  previewWrap.append(preview, overlay);
  previewCard.append(previewWrap);

  const infoCard = createCardNode();
  infoCard.append(
    createTextNode(materialsText.texture_editor_intro),
    createTextNode(materialsText.texture_editor_params)
  );

  const controls = createCardNode();
  controls.style.display = 'grid';
  controls.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
  controls.style.gap = '10px';
  let showUvOutlines = true;

  const getInfo = (): BuiltExportMaterialInfo | BuiltExportSourceMaterialInfo | undefined => {
    const packageData = getPackageData();
    return packageData.analysis.materials.find((entry) => entry.name === materialName)
      ?? packageData.analysis.sourceMaterials.find((entry) => entry.name === materialName);
  };

  const effective = (): Required<NonNullable<MaterialOverrideMap[string]['textureProcessing']>> => ({
    bleedPasses: getOverrides()[materialName]?.textureProcessing?.bleedPasses ?? state.textureProcessing.bleedPasses,
    upscaleTargetSize: getOverrides()[materialName]?.textureProcessing?.upscaleTargetSize
      ?? Math.max(getInfo()?.sourceWidth ?? 1, getInfo()?.sourceHeight ?? 1)
  });

  const ensureOverride = (): NonNullable<MaterialOverrideMap[string]['textureProcessing']> => {
    const overrides = getOverrides();
    overrides[materialName] = {
      ...(overrides[materialName] ?? {}),
      textureProcessing: {
        ...(overrides[materialName]?.textureProcessing ?? {})
      }
    };
    return overrides[materialName].textureProcessing!;
  };

  const syncPreview = (): void => {
    const info = getInfo();
    if (info) {
      preview.src = info.previewDataUrl;
      preview.alt = info.name;
      previewWrap.style.width = `${Math.round(previewZoom * 100)}%`;
      previewWrap.style.maxWidth = `${Math.round(320 * previewZoom)}px`;
      overlay.replaceChildren();
      overlay.style.display = showUvOutlines ? 'block' : 'none';
      for (const polygonPoints of info.uvPolygons) {
        if (polygonPoints.length < 3) {
          continue;
        }

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute(
          'points',
          polygonPoints
            .map(([u, v]) => `${(u * 100).toFixed(3)},${((1 - v) * 100).toFixed(3)}`)
            .join(' ')
        );
        polygon.setAttribute('fill', 'rgba(255,255,255,0.06)');
        polygon.setAttribute('stroke', '#ffe45c');
        polygon.setAttribute('stroke-width', '0.45');
        overlay.append(polygon);
      }
    }
  };

  const overlayToggle = createCardNode();
  overlayToggle.style.display = 'inline-flex';
  overlayToggle.style.alignItems = 'center';
  overlayToggle.style.gap = '8px';
  overlayToggle.style.width = 'fit-content';

  const overlayLabel = document.createElement('label');
  overlayLabel.style.display = 'inline-flex';
  overlayLabel.style.alignItems = 'center';
  overlayLabel.style.gap = '6px';
  overlayLabel.style.fontSize = '12px';

  const overlayInput = document.createElement('input');
  overlayInput.type = 'checkbox';
  overlayInput.checked = showUvOutlines;
  overlayInput.addEventListener('change', () => {
    showUvOutlines = overlayInput.checked;
    syncPreview();
  });
  overlayLabel.append(overlayInput, materialsText.show_uv_outlines);
  overlayToggle.append(overlayLabel);

  const zoomLabel = document.createElement('label');
  zoomLabel.style.display = 'inline-flex';
  zoomLabel.style.alignItems = 'center';
  zoomLabel.style.gap = '6px';
  zoomLabel.style.fontSize = '12px';
  zoomLabel.textContent = materialsText.zoom;
  const zoomSelect = document.createElement('select');
  zoomSelect.innerHTML = `
    <option value="1">1x</option>
    <option value="2">2x</option>
    <option value="4">4x</option>
    <option value="8">8x</option>
  `;
  zoomSelect.value = String(previewZoom);
  zoomSelect.addEventListener('change', () => {
    previewZoom = Number(zoomSelect.value) || 1;
    syncPreview();
  });
  zoomLabel.append(zoomSelect);
  overlayToggle.append(zoomLabel);

  const addNumberField = (
    labelText: string,
    readValue: () => number,
    commit: (value: number) => void,
    min: number
  ): void => {
    const label = document.createElement('label');
    label.style.display = 'grid';
    label.style.gap = '4px';
    label.style.fontSize = '12px';
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.step = '1';
    input.value = String(readValue());
    input.addEventListener('change', () => {
      const next = Number(input.value);
      if (!Number.isFinite(next)) {
        input.value = String(readValue());
        return;
      }
      commit(next);
      onChange();
      input.value = String(readValue());
      syncPreview();
    });
    label.append(input);
    controls.append(label);
  };

  addNumberField(
    materialsText.bleed_passes,
    () => effective().bleedPasses,
    (value) => {
      ensureOverride().bleedPasses = Math.max(0, Math.round(value));
    },
    0
  );
  addNumberField(
    materialsText.upscale_target,
    () => effective().upscaleTargetSize,
    (value) => {
      ensureOverride().upscaleTargetSize = Math.max(1, Math.round(value));
    },
    1
  );

  root.append(previewCard, overlayToggle, infoCard, controls);
  syncPreview();

  new Dialog({
    id: 'dts_texture_processing_dialog',
    title,
    width: 420,
    buttons: ['Close'],
    cancelIndex: 0,
    confirmIndex: 0,
    lines: [root]
  }).show();
}

function createSourceMaterialPolicyRow(
  material: BuiltExportSourceMaterialInfo,
  state: DialogState,
  overrides: MaterialOverrideMap,
  getOverrides: () => MaterialOverrideMap,
  getPackageData: () => BuiltExportPackage,
  onChange: () => void
): HTMLDivElement {
  const row = createCardNode();
  row.style.display = 'grid';
  row.style.alignItems = 'center';
  row.style.gap = '10px';

  const names = document.createElement('div');
  const title = createCodeNode(material.fileName);
  title.style.fontSize = '12px';
  const subtitle = createTextNode(material.name);
  subtitle.style.fontSize = '11px';
  subtitle.style.opacity = '0.7';
  names.append(title, subtitle);

  const policy = document.createElement('select');
  policy.innerHTML = `
    <option value="auto">${materialsText.policy_auto}</option>
    <option value="color">${materialsText.policy_color}</option>
    <option value="texture">${materialsText.policy_texture}</option>
  `;
  policy.value = overrides[material.name]?.exportPolicy ?? material.exportPolicy;
  policy.addEventListener('change', () => {
    overrides[material.name] = {
      ...(overrides[material.name] ?? {}),
      exportPolicy: policy.value as 'auto' | 'color' | 'texture'
    };
    onChange();
  });
  const selectedPolicy = overrides[material.name]?.exportPolicy ?? material.exportPolicy;
  const showsTextureControls = (selectedPolicy === 'texture') || (selectedPolicy === 'auto' && material.effectivePolicy === 'texture');
  row.style.gridTemplateColumns = showsTextureControls
    ? '24px minmax(0, 1fr) auto auto auto'
    : '24px minmax(0, 1fr) auto';

  const glowWrap = document.createElement('label');
  glowWrap.style.display = 'inline-flex';
  glowWrap.style.alignItems = 'center';
  glowWrap.style.gap = '6px';
  glowWrap.style.fontSize = '12px';

  const glow = document.createElement('input');
  glow.type = 'checkbox';
  glow.checked = Boolean(overrides[material.name]?.selfIlluminating);
  glow.addEventListener('change', () => {
    overrides[material.name] = {
      ...(overrides[material.name] ?? {}),
      selfIlluminating: glow.checked
    };
    onChange();
  });
  glowWrap.append(materialsText.glow, glow);

  const editButton = document.createElement('button');
  editButton.textContent = materialsText.edit_texture;
  editButton.type = 'button';
  editButton.addEventListener('click', () => {
    openTextureProcessingDialog(
      material.name,
      `${materialsText.texture_editor_title}: ${material.fileName}`,
      state,
      getOverrides,
      getPackageData,
      onChange
    );
  });

  row.append(createSwatch(material), names, policy);
  if (showsTextureControls) {
    row.append(glowWrap, editButton);
  }
  return row;
}

export function renderMaterials(
  container: HTMLDivElement,
  state: DialogState,
  packageData: BuiltExportPackage,
  getPackageData: () => BuiltExportPackage,
  getOverrides: () => MaterialOverrideMap,
  overrides: MaterialOverrideMap,
  onChange: () => void
): void {
  container.replaceChildren();

  const intro = createTextNode(
    packageData.mode === 'blockland_colors'
      ? materialsText.intro_color_swatches
      : packageData.mode === 'hybrid_textures'
        ? materialsText.intro_mixed_materials
        : materialsText.intro_full_textures
  );
  intro.style.opacity = '0.8';
  container.append(intro);

  if (packageData.mode === 'hybrid_textures' && packageData.analysis.sourceMaterials.length > 0) {
    const sourceWrap = createSectionNode();
    const sourceTitle = createTextNode(materialsText.texture_handling);
    sourceTitle.style.fontSize = '12px';
    sourceTitle.style.opacity = '0.8';
    sourceWrap.append(sourceTitle);

    const sourceList = document.createElement('div');
    sourceList.style.display = 'grid';
    sourceList.style.gap = '8px';

    for (const sourceMaterial of packageData.analysis.sourceMaterials) {
      sourceList.append(createSourceMaterialPolicyRow(sourceMaterial, state, overrides, getOverrides, getPackageData, onChange));
    }

    sourceWrap.append(sourceList);
    container.append(sourceWrap);
  }

  if (packageData.analysis.materials.length === 0) {
    const empty = createCardNode();
    empty.append(createTextNode(materialsText.empty_generated_materials));
    container.append(empty);
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'grid';
  list.style.gap = '8px';

  const visibleMaterials = packageData.mode === 'hybrid_textures'
    ? packageData.analysis.materials.filter((material) => !material.isTextureAsset)
    : packageData.analysis.materials;

  for (const material of visibleMaterials) {
    const row = createCardNode();
    row.style.display = 'grid';
    row.style.gridTemplateColumns = material.isTextureAsset
      ? '24px minmax(0, 1fr) auto auto'
      : '24px minmax(0, 1fr) auto';
    row.style.alignItems = 'center';
    row.style.gap = '10px';

    const names = document.createElement('div');
    const title = createCodeNode(material.fileName);
    title.style.fontSize = '12px';
    const subtitle = createTextNode(material.name);
    subtitle.style.fontSize = '11px';
    subtitle.style.opacity = '0.7';
    names.append(title, subtitle);

    const controls = document.createElement('label');
    controls.style.display = 'inline-flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '6px';
    controls.style.fontSize = '12px';

    const glow = document.createElement('input');
    glow.type = 'checkbox';
    glow.checked = Boolean(overrides[material.name]?.selfIlluminating);
    glow.addEventListener('change', () => {
      overrides[material.name] = {
        ...(overrides[material.name] ?? {}),
        selfIlluminating: glow.checked
      };
      onChange();
    });

    controls.append(materialsText.glow, glow);
    if (material.isTextureAsset && packageData.mode !== 'blockland_colors') {
      const editButton = document.createElement('button');
      editButton.textContent = materialsText.edit_texture;
      editButton.type = 'button';
      editButton.addEventListener('click', () => {
        openTextureProcessingDialog(
          material.name,
          `${materialsText.texture_editor_title}: ${material.fileName}`,
          state,
          getOverrides,
          getPackageData,
          onChange
        );
      });
      row.append(createSwatch(material), names, controls, editButton);
    } else {
      row.append(createSwatch(material), names, controls);
    }
    list.append(row);
  }

  container.append(list);
}
