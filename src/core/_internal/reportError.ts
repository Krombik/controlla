/** `reportError` is a Web API - off-platform an async throw surfaces the same. */
const report: (error: any) => void =
  globalThis.reportError ||
  ((error) => {
    setTimeout(() => {
      throw error;
    });
  });

export default report;
