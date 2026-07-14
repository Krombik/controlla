import type { Lane, PendingItem } from '#internal/types';
import type { RouterPatch } from '#router/internal/types';
import addToLevel from '#internal/addToLevel';

/**
 * Queues the router node in the lane with the given patch — the router's
 * counterpart of a control's `_enqueueSet`; overwrites a pending patch.
 */
const queueRouterPatch = (
  lane: Lane,
  node: PendingItem,
  patch: RouterPatch
) => {
  if (!lane._patchByControl.has(node)) {
    addToLevel(lane, node);
  }

  lane._patchByControl.set(node, patch);
};

export default queueRouterPatch;
