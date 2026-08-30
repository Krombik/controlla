/**
 * True only while `replaceValue`'s enqueue runs - and a field's, when it is
 * told to replace; the router turns such writes into history replaces.
 *
 * Its own module so that a form importing it carries the flag alone, not the
 * router state around it.
 */
export const replacing = { _value: false };
