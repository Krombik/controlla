/**
 * The context object a provider component writes into.
 *
 * `renderHook` has no tree to walk, so it reads a context's current value
 * straight off it - this is how a test hands that value over while still
 * going through the provider the module actually exports. React 19 makes
 * `Context.Provider` the context itself; older ones keep it behind `_context`.
 */
export const contextOf = (element: unknown) => {
  const type = (element as { type: any }).type;

  return type._context || type;
};
