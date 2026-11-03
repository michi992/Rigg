const MiB = 1024 * 1024;

export const LIMITS = Object.freeze({
  modelBytes: 35 * MiB,
  projectBytes: 50 * MiB,
  sourceCharacters: 50_000_000,
  vertices: 300_000,
  joints: 100,
  projectName: 60,
  boneName: 80,
  boneId: 80,
  sourceName: 250,
  coordinate: 100,
  poseAngle: 100,
  falloffMin: 1,
  falloffMax: 6,
  undoEntries: 30,
  morphTargets: 64,
  layers2D: 40,
  imageBytes: 8 * MiB,
  imageDimension: 4096,
});

export const FPS = 24;
export const LAST_FRAME = 120;
export const fileSizeLabel = (bytes) => (bytes / MiB).toLocaleString('de-DE') + ' MB';
