import { RESOLVED_PROMISE } from './constants';

const scheduleMicrotask: typeof queueMicrotask =
  window.queueMicrotask || RESOLVED_PROMISE.then.bind(RESOLVED_PROMISE);

export default scheduleMicrotask;
