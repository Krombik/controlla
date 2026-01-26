import { RootControlNode } from '#internal/types';
import { enqueueSet } from '#internal/flushQueue';

function basicEnqueueSet(
  this: RootControlNode,
  nextValue: any,
  path?: readonly string[]
) {
  enqueueSet(this, nextValue, path);
}

export default basicEnqueueSet;
