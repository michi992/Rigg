import { LAST_FRAME } from '../config.js';
import { $, element } from './dom.js';

export function createTimeRuler() {
  const ticks = [];
  for (let frame = 0; frame <= LAST_FRAME; frame += 10) {
    const tick = element('span', '', frame);
    tick.style.left = (frame / LAST_FRAME) * 100 + '%';
    ticks.push(tick);
  }
  $('time-ruler').replaceChildren(...ticks);
}
export function refreshTimeline(state, updateHint = true) {
  $('frame-number').value = state.frame;
  $('frame-slider').value = state.frame;
  $('frame-slider').max = LAST_FRAME;
  $('frame-number').max = LAST_FRAME;
  $('playhead').style.left = (state.frame / LAST_FRAME) * 100 + '%';
  $('key-count').textContent =
    state.keys.length + ' Keyframe' + (state.keys.length === 1 ? '' : 's');
  const markers = state.keys.map((key) => {
    const marker = element('span', 'key-marker' + (key.frame === state.frame ? ' current' : ''));
    marker.style.left = (key.frame / LAST_FRAME) * 100 + '%';
    marker.title = 'Keyframe ' + key.frame;
    return marker;
  });
  $('key-markers').replaceChildren(...markers);
  $('delete-key').disabled = !state.keys.some((key) => key.frame === state.frame);
  if (updateHint)
    $('timeline-hint').textContent = state.keys.length
      ? 'Die gesamte Pose wird pro Keyframe gespeichert.'
      : 'Pose einstellen → Keyframe setzen → nächsten Frame wählen.';
}
