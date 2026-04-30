import type {
  ControlInternals,
  Lane,
  PrimitiveControlInternals,
} from '#internal/types';

const addToLevel = (
  lane: Lane,
  item: ControlInternals | PrimitiveControlInternals
) => {
  const level = item._level;

  if (lane._maxPendingLevel <= level) {
    lane._maxPendingLevel = level + 1;
  }

  if (lane._minPendingLevel > level) {
    lane._minPendingLevel = level;
  }

  const pendingControlLevels = lane._pendingControlLevels;

  const bucket = pendingControlLevels[level];

  if (bucket) {
    bucket.push(item);
  } else {
    pendingControlLevels[level] = [item];
  }
};

export default addToLevel;
