import type { BuiltExportPackage, BuiltExportSourceMaterialInfo } from '../package';
import {
  createCardNode,
  createCodeNode,
  createSectionNode,
  createSwatch,
  createTextNode,
  type MaterialOverrideMap
} from './shared';
import { materialsText } from './text';

function createSourceMaterialPolicyRow(
  material: BuiltExportSourceMaterialInfo,
  overrides: MaterialOverrideMap,
  onChange: () => void
): HTMLDivElement {
  const row = createCardNode();
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '24px minmax(0, 1fr) auto';
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

  row.append(createSwatch(material), names, policy);
  return row;
}

export function renderMaterials(
  container: HTMLDivElement,
  packageData: BuiltExportPackage,
  overrides: MaterialOverrideMap,
  onChange: () => void
): void {
  container.replaceChildren();

  const intro = createCardNode();
  intro.append(createTextNode(
    packageData.mode === 'blockland_colors'
      ? materialsText.intro_color_swatches
      : packageData.mode === 'hybrid_textures'
        ? materialsText.intro_mixed_materials
        : materialsText.intro_full_textures
  ));
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
      sourceList.append(createSourceMaterialPolicyRow(sourceMaterial, overrides, onChange));
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

  for (const material of packageData.analysis.materials) {
    const row = createCardNode();
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '24px minmax(0, 1fr) auto';
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
    row.append(createSwatch(material), names, controls);
    list.append(row);
  }

  container.append(list);
}
