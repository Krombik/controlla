/**
 * Transient flag: the in-flight `_enqueueSet` came from `replaceValue` —
 * consumers overriding `_enqueueSet` (e.g. the router) can treat the write
 * as a replacement.
 */
const replacing = { _value: false };

export default replacing;
