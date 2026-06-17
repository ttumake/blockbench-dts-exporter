import { createCardNode, createCodeNode, createSectionNode } from './shared';
import { helpText } from './text';

export function renderHelp(container: HTMLDivElement): void {
  container.replaceChildren();

  const help = createSectionNode();
  const quickStart = createCardNode();
  quickStart.append(createCodeNode(helpText.quick_start));

  const exportSettings = createCardNode();
  exportSettings.append(createCodeNode(helpText.export_settings));

  const materials = createCardNode();
  materials.append(createCodeNode(helpText.materials));

  const sequences = createCardNode();
  sequences.append(createCodeNode(helpText.sequences));

  const lods = createCardNode();
  lods.append(createCodeNode(helpText.lod_conventions));

  help.append(quickStart, exportSettings, materials, sequences, lods);
  container.append(help);
}
