import type { ControlInternals } from '#internal/types';
import { INTERNALS, PASSIVE } from '#internal/constants';
import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import syncScheduler from '#scheduler/syncScheduler';
import type { AnchorParam } from '#router/internal/types';
import { ONCE_PASSIVE } from '#router/internal/constants';

const SPY_EVENTS = ['scroll', 'resize', 'orientationchange'] as const;

const IS_SCROLLEND_AVAILABLE =
  typeof window != 'undefined' && 'onscrollend' in window;

const setActiveId = (anchorParam: AnchorParam, id: string | undefined) => {
  const prevId = anchorParam._activeId;

  if (prevId !== id) {
    const root = anchorParam._registered[INTERNALS] as ControlInternals;

    const lane = getSchedulerLane(syncScheduler);

    if (prevId !== undefined) {
      root._enqueueSet(true, lane, [prevId]);
    }

    if (id !== undefined) {
      root._enqueueSet('active', lane, [id]);
    }

    scheduleFlush(lane);

    anchorParam._activeId = id;
  }
};

/**
 * Wraps an `anchor()` so that whichever section it actually scrolls to, or
 * (once scrolling) whichever registered section is actually in view, is
 * marked `'active'` in `selectRegisteredAnchors`, without ever touching the
 * anchor control or the URL. A separate import from `anchor()` itself, so
 * apps that don't use it don't bundle the scroll-spy code.
 *
 * @example
 * ```ts
 * import anchor from 'controlla/router/anchor';
 * import trackScroll from 'controlla/router/trackScroll';
 *
 * createPath('docs', trackScroll(anchor()))
 * ```
 */
const trackScroll = <Ids extends string>(
  anchorParam: AnchorParam<Ids>
): AnchorParam<Ids> => {
  let isSuppressed = false;

  const stopSuppression = () => {
    isSuppressed = false;
  };

  anchorParam._onScrollStart = function (id, options) {
    setActiveId(this, id);

    if (IS_SCROLLEND_AVAILABLE && options.behavior === 'smooth') {
      isSuppressed = true;

      window.addEventListener('scrollend', stopSuppression, ONCE_PASSIVE);
    }
  };

  let rafId: number | undefined;

  let onScroll: (() => void) | undefined;

  anchorParam._startTrack = () => {
    if (onScroll) {
      return;
    }

    const compute = () => {
      rafId = undefined;

      if (isSuppressed) {
        return;
      }

      const { _entries, _getOptions, _offsetEl } = anchorParam;

      const line = _getOptions(_offsetEl).topOffset || 0;

      let nextId: string | undefined;

      let bestTop = -Infinity;

      let maxTop = -Infinity;

      let lowestId: string | undefined;

      for (let i = 0; i < _entries.length; i++) {
        const entry = _entries[i];

        const top = entry._el.getBoundingClientRect().top - line;

        if (top > maxTop) {
          maxTop = top;

          lowestId = entry._id;
        }

        // active = the lowest section whose top is at or above the offset line
        if (top <= 1 && top > bestTop) {
          bestTop = top;

          nextId = entry._id;
        }
      }

      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 1
      ) {
        // page bottom: force the last section active
        nextId = lowestId;
      }

      setActiveId(anchorParam, nextId);
    };

    onScroll = () => {
      rafId ??= requestAnimationFrame(compute);
    };

    for (let i = 0; i < SPY_EVENTS.length; i++) {
      window.addEventListener(SPY_EVENTS[i], onScroll, PASSIVE);
    }
  };

  anchorParam._clear = () => {
    if (!onScroll) {
      return;
    }

    cancelAnimationFrame(rafId!);

    for (let i = 0; i < SPY_EVENTS.length; i++) {
      window.removeEventListener(SPY_EVENTS[i], onScroll);
    }

    onScroll = undefined;
  };

  return anchorParam;
};

export default trackScroll;
