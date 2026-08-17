/**
 * Whether what is being notified came from a load, a recompute or the address
 * bar. Every commit that can be one of those declares its own and clears it
 * again - commits don't nest, so none of them starts on another's answer, and
 * what a listener writes meanwhile commits afterwards on its own, as a write.
 */
export const sourceUpdate = { _value: false };
