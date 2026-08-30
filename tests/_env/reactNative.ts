/**
 * What `react-native` is for the native tests. The real package is Flow
 * source node cannot evaluate, and the modules under test reach for it by
 * bare specifier, so `nativeHooks.js` resolves that specifier here.
 *
 * The same standing as `browser.ts`'s `location`/`history`: the platform is
 * driven by the test rather than mocked away, so what the lib does with it is
 * what runs.
 */

type Size = { width: number; height: number; scale: number; fontScale: number };

const listeners: Record<string, Array<(arg?: any) => any>> = {
  appState: [],
  url: [],
  back: [],
  dimensions: [],
};

const subscribe = (
  into: Array<(arg?: any) => any>,
  listener: (arg?: any) => any
) => {
  into.push(listener);

  return {
    remove() {
      const at = into.indexOf(listener);

      if (at >= 0) {
        into.splice(at, 1);
      }
    },
  };
};

let initialUrl: string | null = null;

let size: Size | undefined = {
  width: 320,
  height: 640,
  scale: 2,
  fontScale: 1,
};

export const AppState = {
  currentState: 'active',
  addEventListener: (_type: string, listener: (state: string) => void) =>
    subscribe(listeners.appState, listener),
};

export const Dimensions = {
  get: () => size,
  addEventListener: (_type: string, listener: (sizes: any) => void) =>
    subscribe(listeners.dimensions, listener),
};

export const Linking = {
  getInitialURL: () => Promise.resolve(initialUrl),
  addEventListener: (
    _type: string,
    listener: (event: { url: string }) => void
  ) => subscribe(listeners.url, listener),
};

export const BackHandler = {
  addEventListener: (_type: string, listener: () => boolean) =>
    subscribe(listeners.back, listener),
};

/** The url the app is launched with - set it before `createRouter` runs. */
export const setInitialUrl = (url: string | null) => {
  initialUrl = url;
};

/** A url arriving while the app is running. */
export const emitUrl = (url: string) => {
  for (let i = 0; i < listeners.url.length; i++) {
    listeners.url[i]({ url });
  }
};

export const emitAppState = (state: string) => {
  AppState.currentState = state;

  for (let i = 0; i < listeners.appState.length; i++) {
    listeners.appState[i](state);
  }
};

export const emitDimensions = (next: Size | undefined) => {
  if (next) {
    size = next;
  }

  for (let i = 0; i < listeners.dimensions.length; i++) {
    listeners.dimensions[i]({ window: next, screen: next });
  }
};

/** The android back button. Returns whether anything handled it. */
export const pressBack = () => {
  for (let i = listeners.back.length; i--;) {
    if (listeners.back[i]()) {
      return true;
    }
  }

  return false;
};

export const countListeners = () => ({
  appState: listeners.appState.length,
  url: listeners.url.length,
  back: listeners.back.length,
  dimensions: listeners.dimensions.length,
});
