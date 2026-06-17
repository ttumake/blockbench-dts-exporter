import type { TabId } from './shared';

export function createTabLayout(): {
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

export function setActiveTab(
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
