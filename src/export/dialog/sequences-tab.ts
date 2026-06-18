import type { BuiltExportPackage, BuiltExportSequenceInfo } from '../package';
import { createCardNode, createCodeNode, createControlLabel, createTextNode, type DialogState } from './shared';
import { sequencesText } from './text';

function createSequenceCard(sequence: BuiltExportSequenceInfo): HTMLDivElement {
  const card = createCardNode();
  const toggleRow = document.createElement('div');
  toggleRow.style.display = 'flex';
  toggleRow.style.alignItems = 'center';
  toggleRow.style.gap = '8px';

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = sequence.enabled;
  toggle.disabled = true;

  const header = createCodeNode(sequence.name);
  header.style.fontSize = '13px';
  header.style.fontWeight = 'bold';
  toggleRow.append(toggle, header);

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
      : sequencesText.no_tracks
  );
  trackSummary.style.marginTop = '8px';
  trackSummary.style.maxHeight = '120px';
  trackSummary.style.overflow = 'auto';

  card.append(toggleRow, meta, trackSummary);

  if (sequence.markers.length > 0) {
    const markerTitle = createTextNode(sequencesText.markers);
    markerTitle.style.marginTop = '8px';
    markerTitle.style.fontSize = '11px';
    markerTitle.style.opacity = '0.8';

    const markers = createCodeNode(
      sequence.markers
        .map((marker) => `${marker.time}  ${marker.name || sequencesText.unnamed_marker}`)
        .join('\n')
    );
    markers.style.marginTop = '4px';

    card.append(markerTitle, markers);
  }

  return card;
}

export function renderSequences(
  container: HTMLDivElement,
  state: DialogState,
  sequences: BuiltExportPackage['analysis']['sequences'],
  refresh: () => void
): void {
  container.replaceChildren();

  const controls = createCardNode();
  const animationToggle = document.createElement('input');
  animationToggle.type = 'checkbox';
  animationToggle.checked = state.exportAnimations;
  animationToggle.addEventListener('change', () => {
    state.exportAnimations = animationToggle.checked;
    refresh();
  });

  const toggleLabel = createControlLabel(sequencesText.export_toggle);
  const toggleRow = document.createElement('label');
  toggleRow.style.display = 'flex';
  toggleRow.style.alignItems = 'center';
  toggleRow.style.gap = '8px';
  toggleRow.append(animationToggle, document.createTextNode(sequencesText.export_toggle));
  toggleLabel.replaceChildren(toggleRow);

  const toggleHelp = createTextNode(
    state.exportAnimations
      ? sequencesText.export_enabled
      : sequencesText.export_disabled
  );
  toggleHelp.style.opacity = '0.85';

  controls.append(toggleLabel, toggleHelp);
  container.append(controls);

  const intro = createCardNode();
  intro.append(createTextNode(
    sequences.length > 0
      ? sequencesText.intro_present
      : sequencesText.intro_absent
  ));
  container.append(intro);

  if (sequences.length === 0) {
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'grid';
  list.style.gap = '8px';

  for (const sequence of sequences) {
    const card = createSequenceCard(sequence);
    const toggle = card.querySelector('input');
    if (toggle) {
      toggle.disabled = !state.exportAnimations;
      toggle.checked = sequence.enabled;
      toggle.addEventListener('change', () => {
        state.enabledSequences[sequence.id] = toggle.checked;
        refresh();
      });
    }
    list.append(card);
  }

  container.append(list);
}
