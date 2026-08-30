/** Resolves the bare `react-native` of the native build to the test's double. */
const double = new URL('./reactNative.ts', import.meta.url).href;

export const resolve = (specifier, context, next) =>
  specifier === 'react-native'
    ? next(double, context)
    : next(specifier, context);
