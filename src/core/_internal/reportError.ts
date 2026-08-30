import type { ErrorUtils as RNErrorUtils } from 'react-native';

/**
 * `reportError` is a Web API - off-platform an async throw surfaces the same.
 * Not in React Native, where a throw out of a timer reaches the *fatal*
 * handler; `ErrorUtils.reportError` is the one that reports without killing
 * the app. The cast is for react-native's own global declaration, which types it
 * as the legacy handle - the one without `reportError`.
 */
const reportError: (error: any) => void = __NATIVE__
  ? (ErrorUtils as RNErrorUtils).reportError
  : globalThis.reportError ||
    ((error) => {
      setTimeout(() => {
        throw error;
      });
    });

export default reportError;
