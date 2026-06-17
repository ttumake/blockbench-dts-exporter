/// <reference types="blockbench-types" />

import { collectModel } from './blockbench/collect-model';
import { showExportDialog } from './export/dialog';
import torqueSvg from '../torque.svg';
import torqueLogoSvg from '../torque-logo.svg';
import type { ExportTextureAsset } from './util/materials';
import { PLUGIN_VERSION } from './version';

const TORQUE_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(torqueSvg)}`;
const TORQUE_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(torqueLogoSvg)}`;


function exportTextureAssets(basePath: string, textureAssets: ExportTextureAsset[]): void {
  const outputDirectory = PathModule.dirname(basePath);

  for (const asset of textureAssets) {
    Filesystem.writeFile(PathModule.join(outputDirectory, asset.fileName), {
      content: asset.dataUrl,
      savetype: 'image'
    });
  }
}

let exportAction: Action;
let exportJsonAction: Action;

BBPlugin.register('dts_exporter', {
  title: 'Torque DTS Exporter',
  author: 'Markus A. Vallin',
  description: 'Exports Blockbench models to Torque DTS format.',
  icon: TORQUE_LOGO,
  tags: ['Exporter', 'Animation', 'Utility'],
  version: PLUGIN_VERSION,
  variant: 'desktop',
  min_version: '5.1.4',

  onload() {
    console.log(`[dts_exporter] loaded v${PLUGIN_VERSION}`);

    // Add an action to export the model as Torque DTS
    exportAction = new Action('export_torque_dts', {
      name: 'Export Torque DTS',
      description: 'Open DTS export options',
      icon: TORQUE_ICON,
      click() {
        showExportDialog(Project?.name ?? 'unnamed', ({ packageData }) => {
          Filesystem.exportFile({
            type: 'Torque DTS Model',
            extensions: ['dts'],
            name: Project?.name || 'model',
            savetype: 'binary',
            content: packageData.content
          }, (filePath) => {
            exportTextureAssets(filePath, packageData.textures);
          });
        });
      }
    });

    // Add the export actions to the File > Export menu
    MenuBar.addAction(exportAction, 'file.export');

    /**
    // Will be removed in the future, this is just a debug action to export the collected model data as JSON for testing purposes.

    // Add a debug action to export the model as JSON for testing
    exportJsonAction = new Action('export_json_debug', {
        name: 'Export JSON (Debug)',
        description: 'Export extracted mesh as JSON for debugging',
        icon: 'code',
        click() {
            const debug = collectModel(Project?.name ?? 'unnamed');

            Blockbench.export({
                type: 'Torque DTS Debug',
                extensions: ['json'],
                name: Project?.name || 'model',
                savetype: 'text',
                content: JSON.stringify(debug, null, 2)
            });
        }
    });

    MenuBar.addAction(exportJsonAction, 'file.export');

    */

    },

    onunload() {
        exportAction.delete();
        //exportJsonAction.delete();
    }
});
