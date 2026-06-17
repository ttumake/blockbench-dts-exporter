import type { BuiltExportPackage, BuiltExportSequenceInfo } from '../package';
import { createCardNode, createCodeNode, createTextNode } from './shared';
import { sequencesText } from './text';

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
      : sequencesText.no_tracks
  );
  trackSummary.style.marginTop = '8px';
  trackSummary.style.maxHeight = '120px';
  trackSummary.style.overflow = 'auto';

  card.append(header, meta, trackSummary);

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
  sequences: BuiltExportPackage['analysis']['sequences']
): void {
  container.replaceChildren();

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
    list.append(createSequenceCard(sequence));
  }

  container.append(list);
}
