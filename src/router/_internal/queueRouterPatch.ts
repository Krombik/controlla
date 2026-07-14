import type { Lane } from '#internal/types';
import type { RouterPatch } from '#router/internal/types';
import addToLevel from '#internal/addToLevel';
import { paramsHandler } from '#router/internal/state';

const queueRouterPatch = (lane: Lane, patch: RouterPatch) => {
  const patchByControl = lane._patchByControl;

  if (!patchByControl.has(paramsHandler)) {
    addToLevel(lane, paramsHandler);
  }

  patchByControl.set(paramsHandler, patch);
};

export default queueRouterPatch;
