/** `reportError` is a Web API - off-platform an async throw surfaces the same. */
const reportError: (error: any) => void =
  globalThis.reportError ||
  ((error) => {
    setTimeout(() => {
      throw error;
    });
  });

export default reportError;
