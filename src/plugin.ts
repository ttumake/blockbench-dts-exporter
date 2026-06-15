/// <reference types="blockbench-types" />

import { collectModel } from './blockbench/collect-model';
import { writeDts } from './dts/writer';

let exportAction: Action;
let exportJsonAction: Action;

BBPlugin.register('dts_exporter', {
  title: 'Torque DTS Exporter',
  author: 'Markus A. Vallin',
  description: 'Exports Blockbench models to Torque DTS format.',
  icon: 'deployed_code',
  version: '0.1.0',
  variant: 'desktop',
  min_version: '5.1.4',

  onload() {

    // Add an action to export the model as Torque DTS
    exportAction = new Action('export_torque_dts', {
      name: 'Export Torque DTS',
      description: 'Export model as Torque DTS',
      icon: 'deployed_code',
      click() {
        const model = collectModel(Project?.name ?? 'unnamed');

        Blockbench.export({
          type: 'Torque DTS Model',
          extensions: ['dts'],
          name: Project?.name || 'model',
          savetype: 'binary',
          content: writeDts(model)
        });
      }
    });

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
        
    // Add the export actions to the File > Export menu
    MenuBar.addAction(exportAction, 'file.export');
    MenuBar.addAction(exportJsonAction, 'file.export');

    },

    onunload() {
        exportAction.delete();
        exportJsonAction.delete();
    }
});
