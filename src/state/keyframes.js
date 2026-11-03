import { LAST_FRAME } from '../config.js';

export function putKeyframe(keys, frame, pose) {
  if (!Number.isInteger(frame) || frame < 0 || frame > LAST_FRAME) {
    throw new Error('Ungültiger Frame.');
  }
  const key = { frame, pose: structuredClone(pose) };
  return [...keys.filter((entry) => entry.frame !== frame), key].sort((a, b) => a.frame - b.frame);
}
export const removeKeyframe = (keys, frame) => keys.filter((key) => key.frame !== frame);
