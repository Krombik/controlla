const scheduleMicrotask: typeof window.queueMicrotask =
  window.queueMicrotask || Promise.prototype.then.bind(Promise.resolve());

export default scheduleMicrotask;
