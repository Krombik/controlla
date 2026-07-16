/**
 * True only while `replaceValue`'s enqueue runs; the router turns such
 * writes into history replaces.
 */
const replacing = { _value: false };

export default replacing;
