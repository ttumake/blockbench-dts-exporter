import type { ExportConfig } from './config';
import { DEFAULT_EXPORT_CONFIG } from './config';
import {
  buildExportPackage,
  type BuiltExportLodInfo,
  type BuiltExportPackage,
  type BuiltExportMaterialInfo,
  type BuiltExportSequenceInfo
} from './package';

type ExportDialogResult = {
  config: ExportConfig;
  packageData: BuiltExportPackage;
};

type ConfirmCallback = (result: ExportDialogResult) => void;

type MaterialOverrideMap = ExportConfig['materialOverrides'];

type TabId = 'general' | 'materials' | 'sequences' | 'lods' | 'help';

type DialogState = {
  mode: ExportConfig['mode'];
  orientation: ExportConfig['orientation'];
  scale: number;
  materialFlags: ExportConfig['materialFlags'];
};

function createSectionNode(): HTMLDivElement {
  const node = document.createElement('div');
  node.style.display = 'grid';
  node.style.gap = '10px';
  return node;
}

function createCardNode(): HTMLDivElement {
  const node = document.createElement('div');
  node.style.padding = '10px 12px';
  node.style.background = 'var(--color-back)';
  node.style.borderRadius = '6px';
  node.style.border = '1px solid color-mix(in srgb, var(--color-border, #000) 60%, transparent)';
  return node;
}

function createTextNode(text = ''): HTMLDivElement {
  const node = document.createElement('div');
  node.textContent = text;
  node.style.whiteSpace = 'pre-wrap';
  node.style.lineHeight = '1.45';
  node.style.fontSize = '12px';
  return node;
}

function createCodeNode(text = ''): HTMLDivElement {
  const node = createTextNode(text);
  node.style.fontFamily = 'monospace';
  return node;
}

function createTabLayout(): {
  root: HTMLDivElement;
  tabButtons: Record<TabId, HTMLButtonElement>;
  tabPanels: Record<TabId, HTMLDivElement>;
} {
  const root = document.createElement('div');
  root.style.display = 'grid';
  root.style.gap = '10px';

  const tabBar = document.createElement('div');
  tabBar.style.display = 'flex';
  tabBar.style.gap = '8px';
  tabBar.style.flexWrap = 'wrap';

  const panelWrap = document.createElement('div');
  panelWrap.style.display = 'grid';

  const tabButtons = {} as Record<TabId, HTMLButtonElement>;
  const tabPanels = {} as Record<TabId, HTMLDivElement>;
  const labels: Record<TabId, string> = {
    general: 'General',
    materials: 'Materials',
    sequences: 'Sequences',
    lods: 'LODs',
    help: 'Help'
  };

  for (const id of Object.keys(labels) as TabId[]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = labels[id];
    button.style.padding = '6px 10px';
    button.style.borderRadius = '6px';
    button.style.border = '1px solid var(--color-border, #444)';
    button.style.background = 'var(--color-button, #2a2a2a)';
    button.style.cursor = 'pointer';

    const panel = document.createElement('div');
    panel.style.display = 'none';
    panel.style.minHeight = '180px';

    tabButtons[id] = button;
    tabPanels[id] = panel;
    tabBar.append(button);
    panelWrap.append(panel);
  }

  root.append(tabBar, panelWrap);

  return { root, tabButtons, tabPanels };
}

function setActiveTab(
  activeTab: TabId,
  tabButtons: Record<TabId, HTMLButtonElement>,
  tabPanels: Record<TabId, HTMLDivElement>
): void {
  for (const id of Object.keys(tabButtons) as TabId[]) {
    const active = id === activeTab;
    tabButtons[id].style.background = active ? 'var(--color-accent, #4d7cff)' : 'var(--color-button, #2a2a2a)';
    tabButtons[id].style.color = active ? 'white' : '';
    tabPanels[id].style.display = active ? 'grid' : 'none';
  }
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

function readBaseConfig(state: DialogState): Omit<ExportConfig, 'materialOverrides'> {
  return {
    mode: state.mode,
    orientation: state.orientation,
    scale: Number.isFinite(state.scale) && state.scale > 0 ? state.scale : DEFAULT_EXPORT_CONFIG.scale,
    materialFlags: {
      sWrap: state.materialFlags.sWrap,
      tWrap: state.materialFlags.tWrap,
      noMipMap: state.materialFlags.noMipMap,
      mipMapZeroBorder: state.materialFlags.mipMapZeroBorder,
      neverEnvMap: state.materialFlags.neverEnvMap
    }
  };
}

function buildConfig(state: DialogState, overrides: MaterialOverrideMap): ExportConfig {
  return {
    ...readBaseConfig(state),
    materialOverrides: cloneMaterialOverrides(overrides)
  };
}

function createStatsGrid(): HTMLDivElement {
  const node = document.createElement('div');
  node.style.display = 'grid';
  node.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
  node.style.gap = '8px';
  return node;
}

function createControlLabel(text: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.style.display = 'grid';
  label.style.gap = '4px';
  label.style.fontSize = '12px';
  label.textContent = text;
  return label;
}

function renderGeneral(
  container: HTMLDivElement,
  state: DialogState,
  config: ExportConfig,
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
    <option value="blockland_colors">Blockland Colors</option>
    <option value="atlas_textures">Atlas Textures</option>
  `;
  modeSelect.value = state.mode;
  modeSelect.addEventListener('change', () => {
    state.mode = modeSelect.value === 'atlas_textures' ? 'atlas_textures' : 'blockland_colors';
    onChange();
  });
  modeLabel.append(modeSelect);

  const orientationLabel = createControlLabel('Orientation');
  const orientationSelect = document.createElement('select');
  orientationSelect.innerHTML = `
    <option value="blockland_swap_yz_flip_xz">Blockland Default</option>
    <option value="none">None</option>
  `;
  orientationSelect.value = state.orientation;
  orientationSelect.addEventListener('change', () => {
    state.orientation = orientationSelect.value === 'none' ? 'none' : 'blockland_swap_yz_flip_xz';
    onChange();
  });
  orientationLabel.append(orientationSelect);

  const scaleLabel = createControlLabel('Scale');
  const scaleInput = document.createElement('input');
  scaleInput.type = 'number';
  scaleInput.min = '0.0001';
  scaleInput.step = '0.01';
  scaleInput.value = String(state.scale);
  scaleInput.addEventListener('change', () => {
    const nextScale = Number(scaleInput.value);
    state.scale = Number.isFinite(nextScale) && nextScale > 0 ? nextScale : DEFAULT_EXPORT_CONFIG.scale;
    scaleInput.value = String(state.scale);
    onChange();
  });
  scaleLabel.append(scaleInput);

  const flagsWrap = document.createElement('div');
  flagsWrap.style.display = 'grid';
  flagsWrap.style.gap = '6px';
  flagsWrap.style.gridColumn = '1 / -1';

  const flagTitle = createTextNode('Global Material Flags');
  flagTitle.style.fontSize = '12px';
  flagTitle.style.opacity = '0.8';
  flagsWrap.append(flagTitle);

  const flagGrid = document.createElement('div');
  flagGrid.style.display = 'grid';
  flagGrid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
  flagGrid.style.gap = '6px 12px';

  const addFlag = (
    key: keyof DialogState['materialFlags'],
    label: string
  ): void => {
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

  controls.append(modeLabel, orientationLabel, scaleLabel, flagsWrap);

  const intro = createCardNode();
  intro.append(createTextNode(
    'This dialog controls how the Blockbench model is normalized before writing DTS. ' +
    'Mode changes the texture/material strategy. Orientation and scale affect geometry, nodes, and animation tracks.'
  ));

  const stats = createStatsGrid();
  const statEntries = [
    ['Mode', packageData.mode === 'blockland_colors' ? 'Blockland Colors' : 'Atlas Textures'],
    ['Textures', String(packageData.analysis.textureCount)],
    ['Materials', String(packageData.analysis.materialCount)],
    ['Objects', String(packageData.analysis.objectCount)],
    ['Nodes', String(packageData.analysis.nodeCount)],
    ['Sequences', String(packageData.analysis.sequenceCount)]
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
    `Orientation: ${config.orientation === 'blockland_swap_yz_flip_xz' ? 'Blockland Default' : 'None'}`,
    `Scale: ${config.scale}`,
    '',
    'Global material flags:',
    `- S Wrap: ${config.materialFlags.sWrap}`,
    `- T Wrap: ${config.materialFlags.tWrap}`,
    `- No MipMap: ${config.materialFlags.noMipMap}`,
    `- Zero Border: ${config.materialFlags.mipMapZeroBorder}`,
    `- Never EnvMap: ${config.materialFlags.neverEnvMap}`
  ].join('\n')));

  const sequences = createCardNode();
  sequences.append(createCodeNode([
    `Animation sequences: ${packageData.analysis.sequenceCount}`,
    `Animation tracks: ${packageData.analysis.animationTrackCount}`,
    '',
    packageData.analysis.sequenceCount > 0
      ? 'Collected Blockbench animations are exported into DTS sequences.'
      : 'No Blockbench animations were found in the current project.'
  ].join('\n')));

  summary.append(controls, intro, stats, flags, sequences);
  container.append(summary);
}

function createSwatch(material: BuiltExportMaterialInfo): HTMLImageElement {
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

function renderMaterials(
  container: HTMLDivElement,
  packageData: BuiltExportPackage,
  overrides: MaterialOverrideMap,
  onChange: () => void
): void {
  container.replaceChildren();

  const intro = createCardNode();
  intro.append(createTextNode(
    packageData.mode === 'blockland_colors'
      ? 'Blockland Colors generates small texture swatches and maps each face to the full texture. Use Glow per material below.'
      : 'Atlas Textures exports the source texture assets and keeps atlas UVs. Glow can still be overridden per exported material.'
  ));
  container.append(intro);

  if (packageData.analysis.materials.length === 0) {
    const empty = createCardNode();
    empty.append(createTextNode('No generated materials for this export.'));
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

    controls.append('Glow', glow);
    row.append(createSwatch(material), names, controls);
    list.append(row);
  }

  container.append(list);
}

function renderLods(container: HTMLDivElement, lodInfo: BuiltExportPackage['analysis']['lod']): void {
  container.replaceChildren();

  const intro = createCardNode();
  intro.append(createCodeNode([
    `LOD mode: ${lodInfo.enabled ? 'Explicit detailNN groups' : 'Single default detail'}`,
    `LOD levels: ${lodInfo.levelCount}`,
    '',
    lodInfo.modeDescription
  ].join('\n')));
  container.append(intro);

  if (lodInfo.levels.length === 0) {
    return;
  }

  const levels = document.createElement('div');
  levels.style.display = 'grid';
  levels.style.gap = '8px';

  for (const level of lodInfo.levels) {
    const card = createLodCard(level);
    levels.append(card);
  }

  container.append(levels);
}

function renderSequences(
  container: HTMLDivElement,
  sequences: BuiltExportPackage['analysis']['sequences']
): void {
  container.replaceChildren();

  const intro = createCardNode();
  intro.append(createTextNode(
    sequences.length > 0
      ? 'Collected Blockbench animations that will be written as DTS sequences.'
      : 'No Blockbench animations were found in the current project.'
  ));
  container.append(intro);

  if (sequences.length === 0) {
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'grid';
  list.style.gap = '8px';

  for (const sequence of sequences) {
    list.append(createSequenceCard(sequence));
  }

  container.append(list);
}

function createSequenceCard(sequence: BuiltExportSequenceInfo): HTMLDivElement {
  const card = createCardNode();
  const header = createCodeNode(sequence.name);
  header.style.fontSize = '13px';
  header.style.fontWeight = 'bold';

  const meta = createCodeNode([
    `Length: ${sequence.length}`,
    `Loop: ${sequence.loop}`,
    `Snapping: ${sequence.snapping}`,
    `Tracks: ${sequence.trackCount}`,
    `Markers: ${sequence.markerCount}`
  ].join('  |  '));
  meta.style.marginTop = '4px';
  meta.style.fontSize = '11px';

  const trackSummary = createCodeNode(
    sequence.tracks.length > 0
      ? sequence.tracks
        .map((track) => `${track.targetName} :: ${track.channel} (${track.keyframeCount} keys)`)
        .join('\n')
      : 'No tracks'
  );
  trackSummary.style.marginTop = '8px';
  trackSummary.style.maxHeight = '120px';
  trackSummary.style.overflow = 'auto';

  card.append(header, meta, trackSummary);

  if (sequence.markers.length > 0) {
    const markerTitle = createTextNode('Markers');
    markerTitle.style.marginTop = '8px';
    markerTitle.style.fontSize = '11px';
    markerTitle.style.opacity = '0.8';

    const markers = createCodeNode(
      sequence.markers
        .map((marker) => `${marker.time}  ${marker.name || '(unnamed)'}`)
        .join('\n')
    );
    markers.style.marginTop = '4px';

    card.append(markerTitle, markers);
  }

  return card;
}

function createLodCard(level: BuiltExportLodInfo): HTMLDivElement {
  const card = createCardNode();
  const header = createCodeNode(`${level.name}  (size ${level.size})`);
  header.style.fontSize = '13px';
  header.style.fontWeight = 'bold';

  const details = createTextNode(`Objects: ${level.objectCount}`);
  details.style.marginTop = '4px';

  const list = createCodeNode(level.objectNames.join('\n'));
  list.style.marginTop = '8px';
  list.style.maxHeight = '120px';
  list.style.overflow = 'auto';

  card.append(header, details, list);
  return card;
}

function renderHelp(container: HTMLDivElement): void {
  container.replaceChildren();

  const help = createSectionNode();
  const mode = createCardNode();
  mode.append(createCodeNode([
    'Mode',
    '- Blockland Colors: samples face colors, generates small swatch textures, remaps faces to full 0..1 UVs.',
    '- Atlas Textures: preserves atlas textures and exports the source texture assets.'
  ].join('\n')));

  const transforms = createCardNode();
  transforms.append(createCodeNode([
    'Transform Settings',
    '- Orientation changes geometry, helper nodes, and animation translation tracks to match Blockland.',
    '- Scale uniformly shrinks or enlarges geometry, helper nodes, and animation translation tracks before export.'
  ].join('\n')));

  const lods = createCardNode();
  lods.append(createCodeNode([
    'LOD Conventions',
    '- Create groups named like detail128, detail64, detail32.',
    '- Keep shared helper nodes like muzzlePoint outside the detail groups.',
    '- Match object names across LODs. A suffix after # is ignored when pairing variants.'
  ].join('\n')));

  const flags = createCardNode();
  flags.append(createCodeNode([
    'Material Flags',
    '- S Wrap / T Wrap: allow texture wrapping on the corresponding axis.',
    '- No MipMap: disables mipmaps for exported materials.',
    '- Zero Border: enables the Torque zero-border mipmap flag.',
    '- Never EnvMap: disables environment mapping.',
    '- Glow is per material, not global.'
  ].join('\n')));

  help.append(mode, transforms, lods, flags);
  container.append(help);
}

export function showExportDialog(projectName: string, onConfirmExport: ConfirmCallback): Dialog {
  const { root, tabButtons, tabPanels } = createTabLayout();
  const state: DialogState = {
    mode: DEFAULT_EXPORT_CONFIG.mode,
    orientation: DEFAULT_EXPORT_CONFIG.orientation,
    scale: DEFAULT_EXPORT_CONFIG.scale,
    materialFlags: { ...DEFAULT_EXPORT_CONFIG.materialFlags }
  };
  let currentOverrides = cloneMaterialOverrides(DEFAULT_EXPORT_CONFIG.materialOverrides);
  let currentConfig: ExportConfig = {
    ...DEFAULT_EXPORT_CONFIG,
    materialOverrides: currentOverrides
  };
  let currentPackage = buildExportPackage(projectName, currentConfig);

  const refresh = (): void => {
    const baseConfig = readBaseConfig(state);
    currentOverrides = normalizeMaterialOverrides(currentPackage.materialNames, currentOverrides);
    currentConfig = {
      ...baseConfig,
      materialOverrides: cloneMaterialOverrides(currentOverrides)
    };
    currentPackage = buildExportPackage(projectName, currentConfig);
    currentOverrides = normalizeMaterialOverrides(currentPackage.materialNames, currentOverrides);
    currentConfig = buildConfig(state, currentOverrides);

    renderGeneral(tabPanels.general, state, currentConfig, currentPackage, refresh);
    renderMaterials(tabPanels.materials, currentPackage, currentOverrides, refresh);
    renderSequences(tabPanels.sequences, currentPackage.analysis.sequences);
    renderLods(tabPanels.lods, currentPackage.analysis.lod);
    renderHelp(tabPanels.help);
  };

  const dialog = new Dialog({
    id: 'dts_export_dialog',
    title: 'Export DTS',
    width: 720,
    buttons: ['Cancel', 'Export'],
    cancelIndex: 0,
    confirmIndex: 1,
    lines: [root],
    onConfirm() {
      onConfirmExport({
        config: currentConfig,
        packageData: currentPackage
      });
    }
  });

  for (const tabId of Object.keys(tabButtons) as TabId[]) {
    tabButtons[tabId].addEventListener('click', () => {
      setActiveTab(tabId, tabButtons, tabPanels);
    });
  }

  setActiveTab('general', tabButtons, tabPanels);
  refresh();
  dialog.show();
  return dialog;
}
