import { ControlRoot } from '#_types';
import { enqueueSet } from './batching';

function basicEnqueueSet(
  this: ControlRoot,
  nextValue: any,
  path?: readonly string[]
) {
  enqueueSet(this, nextValue, path);
}

export default basicEnqueueSet;
