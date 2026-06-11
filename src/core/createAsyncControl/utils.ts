import type {
  AsyncControlInternals,
  ChangeListener,
  ErrorControlInternals,
  Listeners,
} from '#internal/types';
import scheduleMicrotask from '#internal/scheduleMicrotask';
import {
  addListener,
  getCurrentLane,
  getLane,
  removeListener,
  scheduleFlush,
} from '#internal/flushQueue';
import { SILENT_RELOAD, INTERNALS } from '#internal/constants';

const visibilityChangeQueue: AsyncControlInternals[] = [];

const visibilityChangeIndexMap = new Map<AsyncControlInternals, number>();

const triggerSilentReload = (internals: AsyncControlInternals) => {
  const currLine = getCurrentLane();

  if (currLine) {
    internals._enqueueSet(SILENT_RELOAD, currLine, undefined);
  } else {
    const lane = getLane(scheduleMicrotask);

    internals._enqueueSet(SILENT_RELOAD, lane, undefined);

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

const endLoad = (internals: AsyncControlInternals) => {
  const load = internals._load!;

  internals._attempt = 0;

  load._loadedAt =
    load._source.reloadOnFocus || load._source.reloadIfStale ? Date.now() : 1;

  cleanupLoad(load);
};

export const triggerLoad = (internals: AsyncControlInternals) => {
  const data = internals._load!;

  const { _slowLoadMonitor } = data;

  data._loadedAt = 0;

  data._cleanup = data._source.load!(
    {
      setValue(value, scheduler) {
        const isLoaded = internals._isLoaded(
          value,
          internals._value,
          internals._attempt
        );

        if (isLoaded) {
          endLoad(internals);
        }

        internals._enqueueSet(value, getLane(scheduler || scheduleMicrotask));

        return !isLoaded;
      },
      setError(value, scheduler) {
        endLoad(internals);

        internals._errorControl[INTERNALS]._enqueueSet(
          value,
          getLane(scheduler || scheduleMicrotask)
        );
      },
      stillLoading: () => !data._loadedAt,
      getValue: () => internals._get(),
    },
    data._keys!
  );

  if (_slowLoadMonitor) {
    _slowLoadMonitor._timerId = setTimeout(() => {
      _slowLoadMonitor._listeners.forEach((listener) => listener());
    }, data._source.loadingTimeout!);
  }
};

const loaderCleanupSet: AsyncControlInternals[] = [];

let isLoadCleanupPending = true;

export const cleanupLoad = (
  load: NonNullable<AsyncControlInternals['_load']>
) => {
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
      cleanupLoad(source);

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
