import addToLevel from '#internal/addToLevel';
import type { Lane, PendingItem } from '#internal/types';

const addToQueue = (lane: Lane, root: PendingItem) => {
  const patchByControl = lane._patchByControl;

  if (!patchByControl.has(root)) {
    addToLevel(lane, root);

    patchByControl.set(root, null);
  }
};

export default addToQueue;
