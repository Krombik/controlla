/**
 * The build substitutes `__NATIVE__`; running the source under node has to
 * stand it up, and the source is what the web build compiles to.
 */
(globalThis as Record<string, unknown>).__NATIVE__ = false;
