import type {
  AsyncControlInternals,
  ChangeListener,
  ErrorControlInternals,
  Lane,
  Listeners,
} from '#internal/types';
import { INTERNALS } from '#shared-internal/constants';
import notify from '#internal/notify';
import scheduleMicrotask from '#internal/scheduleMicrotask';
import {
  addListener,
  getCurrentLane,
  getLane,
  removeListener,
  scheduleFlush,
} from '#internal/flushQueue';
import { SILENT_RELOAD } from '#internal/constants';

const visibilityChangeQueue: AsyncControlInternals[] = [];

const visibilityChangeIndexMap = new Map<AsyncControlInternals, number>();

const triggerSilentReload = (internals: AsyncControlInternals) => {
  const currLine = getCurrentLane();

  const errInternals = internals._errorControl[INTERNALS];

  if (currLine) {
    errInternals._enqueueSet(SILENT_RELOAD, currLine);
  } else {
    const lane = getLane(scheduleMicrotask);

    errInternals._enqueueSet(SILENT_RELOAD, lane);

    scheduleFlush(lane, scheduleMicrotask);
  }
};

const visibilityChangeListener = () => {
  if (!document.hidden) {
    for (let i = 0; i < visibilityChangeQueue.length; i++) {
      const internals = visibilityChangeQueue[i];

      const source = internals._load!;

      if (
        source._loadedAt &&
        source._source.reloadOnFocus! + source._loadedAt < Date.now()
      ) {
        triggerSilentReload(internals);
      }
    }
  }
};

const triggerLoad = (internals: AsyncControlInternals) => {
  const data = internals._load!;

  const { _slowLoadMonitor } = data;

  data._loadedAt = 0;

  data._cleanup = data._source.load(internals as any, data._keys);

  if (_slowLoadMonitor) {
    _slowLoadMonitor._timerId = setTimeout(() => {
      const listeners = _slowLoadMonitor._listeners;

      for (let i = 0; i < listeners.length; i++) {
        listeners[i]();
      }
    }, data._source.loadingTimeout!);
  }
};

const loaderCleanupSet: AsyncControlInternals[] = [];

let isLoadCleanupPending = true;

const cleanup = (load: NonNullable<AsyncControlInternals['_load']>) => {
  const { _slowLoadMonitor } = load;

  if (load._cleanup) {
    load._cleanup = load._cleanup();
  }

  if (_slowLoadMonitor && _slowLoadMonitor._timerId != null) {
    clearTimeout(_slowLoadMonitor._timerId);

    _slowLoadMonitor._timerId = undefined;
  }
};

const handleUnloads = () => {
  for (let i = 0; i < loaderCleanupSet.length; i++) {
    const internals = loaderCleanupSet[i];

    const source = internals._load!;

    source._canScheduleUnload = true;

    if (!source._activeCount) {
      cleanup(source);

      if (source._source.reloadOnFocus) {
        const last = visibilityChangeQueue.pop()!;

        if (last != internals) {
          const index = visibilityChangeIndexMap.get(internals)!;

          visibilityChangeQueue[index] = last;

          visibilityChangeIndexMap.set(last, index)!;
        }

        if (!visibilityChangeQueue.length) {
          document.removeEventListener(
            'visibilitychange',
            visibilityChangeListener
          );
        }

        visibilityChangeIndexMap.delete(internals);
      }
    }
  }

  loaderCleanupSet.length = 0;

  isLoadCleanupPending = true;
};

export const handleLoadingStateControls = (
  internals: AsyncControlInternals,
  lane: Lane,
  isLoaded: boolean,
  nextReady: true | undefined
) => {
  const loadingControl = internals._loadingControl[INTERNALS];

  const readyControl = internals._readyControl[INTERNALS];

  const prevLoading = loadingControl._value;

  const prevReady = readyControl._value;

  const nextLoading = !isLoaded;

  const source = internals._load;

  if (isLoaded && source) {
    source._loadedAt =
      source._source.reloadOnFocus || source._source.reloadIfStale
        ? Date.now()
        : 1;
  }

  if (nextLoading != prevLoading) {
    loadingControl._value = nextLoading;

    notify(
      loadingControl._listeners,
      loadingControl._dependents,
      lane,
      nextLoading,
      prevLoading
    );

    if (source) {
      if (source._activeCount || !source._canScheduleUnload) {
        if (isLoaded) {
          cleanup(source);
        } else {
          triggerLoad(internals);
        }
      } else if (nextLoading) {
        source._loadedAt = 0;
      }
    }
  }

  if (prevReady !== nextReady) {
    readyControl._value = nextReady;

    notify(
      readyControl._listeners,
      readyControl._dependents,
      lane,
      nextReady,
      prevReady
    );
  }
};

const attachLoad = (control: AsyncControlInternals) => {
  const data = control._load!;

  if (!data._activeCount++ && data._canScheduleUnload) {
    if (!data._loadedAt) {
      triggerLoad(control);
    } else if (
      data._source.reloadIfStale &&
      data._loadedAt + data._source.reloadIfStale < Date.now()
    ) {
      triggerSilentReload(control);
    }

    if (data._source.reloadOnFocus) {
      if (!visibilityChangeQueue.length) {
        document.addEventListener('visibilitychange', visibilityChangeListener);
      }

      visibilityChangeIndexMap.set(control, visibilityChangeQueue.length);

      visibilityChangeQueue.push(control);
    }
  }
};

const detachLoad = (control: AsyncControlInternals) => {
  const data = control._load!;

  if (!--data._activeCount && data._canScheduleUnload) {
    loaderCleanupSet.push(control);

    data._canScheduleUnload = false;

    if (isLoadCleanupPending) {
      isLoadCleanupPending = false;

      scheduleMicrotask(handleUnloads);
    }
  }
};

export function attachAsync(
  this: AsyncControlInternals,
  control: Listeners<ChangeListener>,
  listener: ChangeListener,
  isLoad: boolean
) {
  if (control) {
    addListener(control, listener!);
  }

  if (isLoad) {
    attachLoad(this);
  }
}

export function detachAsync(
  this: AsyncControlInternals,
  control: Listeners<ChangeListener>,
  listener: ChangeListener,
  isLoad: boolean
) {
  if (control) {
    removeListener(control, listener!);
  }

  if (isLoad) {
    detachLoad(this);
  }
}

export function errorAttachAsync(
  this: ErrorControlInternals<AsyncControlInternals>,
  control: Listeners<ChangeListener>,
  listener: ChangeListener,
  isLoad: boolean
) {
  if (control) {
    addListener(control, listener!);
  }

  if (isLoad) {
    attachLoad(this._parent);
  }
}

export function errorDetachAsync(
  this: ErrorControlInternals<AsyncControlInternals>,
  control: Listeners<ChangeListener>,
  listener: ChangeListener,
  isLoad: boolean
) {
  if (control) {
    removeListener(control, listener!);
  }

  if (isLoad) {
    detachLoad(this._parent);
  }
}
