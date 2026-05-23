import addToLevel from '#internal/addToLevel';
import { ControlInternals, Lane } from '#internal/types';

const addToQueue = (lane: Lane, root: ControlInternals) => {
  const patchByControl = lane._patchByControl;

  if (!patchByControl.has(root)) {
    addToLevel(lane, root);

    patchByControl.set(root, null);
  }
};

export default addToQueue;
