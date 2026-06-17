import type { ExportConfig } from './config';
import { DEFAULT_EXPORT_CONFIG } from './config';
import { buildExportPackage } from './package';
import {
  renderGeneral,
  renderHelp,
  renderLods,
  renderMaterials,
  renderSequences
} from './dialog/renderers';
import {
  buildConfig,
  cloneMaterialOverrides,
  normalizeMaterialOverrides,
  readBaseConfig,
  type ConfirmCallback,
  type DialogState,
  type TabId
} from './dialog/shared';
import { createTabLayout, setActiveTab } from './dialog/tabs';

export function showExportDialog(projectName: string, onConfirmExport: ConfirmCallback): Dialog {
  const { root, tabButtons, tabPanels } = createTabLayout();
  const state: DialogState = {
    dtsVersion: DEFAULT_EXPORT_CONFIG.dtsVersion,
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
