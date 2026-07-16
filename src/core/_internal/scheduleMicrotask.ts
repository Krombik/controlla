const scheduleMicrotask: (cb: () => void) => void =
  typeof queueMicrotask != 'undefined'
    ? queueMicrotask
    : Promise.prototype.then.bind(Promise.resolve());

export default scheduleMicrotask;
