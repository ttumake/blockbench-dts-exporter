import type { BuiltExportLodInfo, BuiltExportPackage } from '../package';
import { createCardNode, createCodeNode, createTextNode } from './shared';
import { lodsText } from './text';

function createLodCard(level: BuiltExportLodInfo): HTMLDivElement {
  const card = createCardNode();
  const header = createCodeNode(`${level.name}  (size ${level.size})`);
  header.style.fontSize = '13px';
  header.style.fontWeight = 'bold';

  const details = createTextNode(`${lodsText.objects}: ${level.objectCount}`);
  details.style.marginTop = '4px';

  const list = createCodeNode(level.objectNames.join('\n'));
  list.style.marginTop = '8px';
  list.style.maxHeight = '120px';
  list.style.overflow = 'auto';

  card.append(header, details, list);
  return card;
}

export function renderLods(container: HTMLDivElement, lodInfo: BuiltExportPackage['analysis']['lod']): void {
  container.replaceChildren();

  const intro = createCardNode();
  intro.append(createCodeNode([
    `LOD mode: ${lodInfo.enabled ? lodsText.explicit_detail_groups : lodsText.single_default_detail}`,
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
    levels.append(createLodCard(level));
  }

  container.append(levels);
}
