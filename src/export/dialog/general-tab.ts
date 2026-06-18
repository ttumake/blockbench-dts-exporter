import type { BuiltExportPackage } from '../package';
import {
  createCardNode,
  createCodeNode,
  createControlLabel,
  createSectionNode,
  createStatsGrid,
  createTextNode,
  type DialogState
} from './shared';
import { generalText } from './text';

export function renderGeneral(
  container: HTMLDivElement,
  state: DialogState,
  currentConfig: { orientation: string; scale: number; materialFlags: DialogState['materialFlags'] },
  packageData: BuiltExportPackage,
  onChange: () => void
): void {
  container.replaceChildren();

  const summary = createSectionNode();
  const controls = createCardNode();
  controls.style.display = 'grid';
  controls.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
  controls.style.gap = '10px';

  const modeLabel = createControlLabel('Mode');
  const modeSelect = document.createElement('select');
  modeSelect.innerHTML = `
    <option value="hybrid_textures">${generalText.mode_mixed_materials}</option>
    <option value="blockland_colors">${generalText.mode_color_swatches}</option>
    <option value="atlas_textures">${generalText.mode_full_textures}</option>
  `;
  modeSelect.value = state.mode;
  modeSelect.addEventListener('change', () => {
    state.mode = modeSelect.value === 'atlas_textures'
      ? 'atlas_textures'
      : modeSelect.value === 'hybrid_textures'
        ? 'hybrid_textures'
        : 'blockland_colors';
    onChange();
  });
  modeLabel.append(modeSelect);

  const versionLabel = createControlLabel(generalText.dts_version);
  const versionSelect = document.createElement('select');
  versionSelect.innerHTML = `
    <option value="24">${generalText.dts_version_24}</option>
    <option value="25">${generalText.dts_version_25}</option>
  `;
  versionSelect.value = String(state.dtsVersion);
  versionSelect.addEventListener('change', () => {
    state.dtsVersion = versionSelect.value === '25' ? 25 : 24;
    onChange();
  });
  versionLabel.append(versionSelect);

  const orientationLabel = createControlLabel('Orientation');
  const orientationSelect = document.createElement('select');
  orientationSelect.innerHTML = `
    <option value="blockland_swap_yz_flip_xz">${generalText.orientation_default}</option>
    <option value="none">${generalText.orientation_none}</option>
  `;
  orientationSelect.value = state.orientation;
  orientationSelect.addEventListener('change', () => {
    state.orientation = orientationSelect.value === 'none' ? 'none' : 'blockland_swap_yz_flip_xz';
    onChange();
  });
  orientationLabel.append(orientationSelect);

  const flagsWrap = document.createElement('div');
  flagsWrap.style.display = 'grid';
  flagsWrap.style.gap = '6px';
  flagsWrap.style.gridColumn = '1 / -1';

  const flagTitle = createTextNode(generalText.material_flags);
  flagTitle.style.fontSize = '12px';
  flagTitle.style.opacity = '0.8';
  flagsWrap.append(flagTitle);

  const flagGrid = document.createElement('div');
  flagGrid.style.display = 'grid';
  flagGrid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
  flagGrid.style.gap = '6px 12px';

  const addFlag = (key: keyof DialogState['materialFlags'], label: string): void => {
    const wrap = document.createElement('label');
    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '6px';
    wrap.style.fontSize = '12px';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = state.materialFlags[key];
    input.addEventListener('change', () => {
      state.materialFlags[key] = input.checked;
      onChange();
    });
    wrap.append(input, label);
    flagGrid.append(wrap);
  };

  addFlag('sWrap', 'S Wrap');
  addFlag('tWrap', 'T Wrap');
  addFlag('noMipMap', 'No MipMap');
  addFlag('mipMapZeroBorder', 'Zero Border');
  addFlag('neverEnvMap', 'Never EnvMap');
  flagsWrap.append(flagGrid);

  controls.append(modeLabel, versionLabel, orientationLabel, flagsWrap);

  const stats = createStatsGrid();
  const statEntries = [
    ['DTS', String(state.dtsVersion)],
    ['Mode', 
      packageData.mode === 'blockland_colors' ? 
      generalText.mode_color_swatches : packageData.mode === 'hybrid_textures' ? 
      generalText.mode_mixed_materials : generalText.mode_full_textures
    ],
    ['Textures', String(packageData.analysis.textureCount)],
    ['Materials', String(packageData.analysis.materialCount)],
    ['Objects', String(packageData.analysis.objectCount)],
    ['Nodes', String(packageData.analysis.nodeCount)]
  ];

  for (const [label, value] of statEntries) {
    const card = createCardNode();
    const labelNode = createTextNode(label);
    labelNode.style.opacity = '0.75';
    labelNode.style.fontSize = '11px';
    const valueNode = createCodeNode(value);
    valueNode.style.fontSize = '14px';
    valueNode.style.fontWeight = 'bold';
    card.append(labelNode, valueNode);
    stats.append(card);
  }

  const flags = createCardNode();
  flags.append(createCodeNode([
    `DTS Version: ${state.dtsVersion}`,
    `Orientation: 
      ${
        currentConfig.orientation === 'blockland_swap_yz_flip_xz' ?
        generalText.orientation_default : generalText.orientation_none
      }`,
    'Global material flags:',
    `- S Wrap: ${currentConfig.materialFlags.sWrap}`,
    `- T Wrap: ${currentConfig.materialFlags.tWrap}`,
    `- No MipMap: ${currentConfig.materialFlags.noMipMap}`,
    `- Zero Border: ${currentConfig.materialFlags.mipMapZeroBorder}`,
    `- Never EnvMap: ${currentConfig.materialFlags.neverEnvMap}`
  ].join('\n')));

  const sequences = createCardNode();
  sequences.append(createCodeNode([
    `Animation sequences: ${packageData.analysis.sequenceCount}`,
    `Animation tracks: ${packageData.analysis.animationTrackCount}`,
    '',
    packageData.analysis.sequenceCount > 0
      ? generalText.summary_with_sequences
      : generalText.summary_without_sequences
  ].join('\n')));

  summary.append(controls, stats, flags, sequences);
  container.append(summary);
}
