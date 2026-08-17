import type { ControlInternals } from '#internal/types';
import { INTERNALS, PASSIVE } from '#internal/constants';
import { getLane, scheduleFlush } from '#internal/flushQueue';
import type { AnchorParam } from '#router/internal/types';
import { ONCE_PASSIVE } from '#router/internal/constants';

const ACTIVATION_DEPTH = 0.25;

const IS_SCROLLEND_AVAILABLE =
  typeof window != 'undefined' && 'onscrollend' in window;

const IS_RESIZE_OBSERVER_ENABLED = typeof ResizeObserver != 'undefined';

const setActiveId = (anchorParam: AnchorParam, id: string | undefined) => {
  const prevId = anchorParam._activeId;

  if (prevId !== id) {
    const root = anchorParam._registered[INTERNALS] as ControlInternals;

    const lane = getLane(requestAnimationFrame);

    if (prevId !== undefined) {
      const entries = anchorParam._entries;

      for (let i = 0; i < entries.length; i++) {
        if (entries[i]._id == prevId) {
          root._enqueueSet(true, lane, true, [prevId]);

          break;
        }
      }
    }

    if (id !== undefined) {
      root._enqueueSet('active', lane, true, [id]);
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

  let observer: ResizeObserver | undefined;

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

      const viewportHeight = window.innerHeight;

      let nextId: string | undefined;

      let bestTop = -Infinity;

      let maxTop = -Infinity;

      let lowestId: string | undefined;

      let firstVisibleTop = Infinity;

      let firstVisibleId: string | undefined;

      for (let i = 0; i < _entries.length; i++) {
        const entry = _entries[i];

        const offset = _getOptions(_offsetEl, entry._id).topOffset || 0;

        const elementTop = entry._el.getBoundingClientRect().top;

        const depth = (viewportHeight - offset) * ACTIVATION_DEPTH;

        const top = elementTop - offset - depth;

        if (top > maxTop) {
          maxTop = top;

          lowestId = entry._id;
        }

        if (
          elementTop < viewportHeight - depth &&
          elementTop < firstVisibleTop
        ) {
          firstVisibleTop = elementTop;

          firstVisibleId = entry._id;
        }

        // active = the lowest section whose top has reached the probe
        if (top <= 1 && top > bestTop) {
          bestTop = top;

          nextId = entry._id;
        }
      }

      const scrollHeight = document.documentElement.scrollHeight;

      if (
        scrollHeight > viewportHeight &&
        viewportHeight + window.scrollY >= scrollHeight - 1
      ) {
        nextId = lowestId;
      } else if (nextId === undefined) {
        nextId = firstVisibleId;
      }

      setActiveId(anchorParam, nextId);
    };

    onScroll = () => {
      rafId ??= requestAnimationFrame(compute);
    };

    window.addEventListener('scroll', onScroll, PASSIVE);

    window.addEventListener('resize', onScroll, PASSIVE);

    if (IS_RESIZE_OBSERVER_ENABLED) {
      (observer = new ResizeObserver(onScroll)).observe(
        document.documentElement
      );
    } else {
      window.addEventListener('orientationchange', onScroll, PASSIVE);
    }
  };

  anchorParam._clear = () => {
    if (!onScroll) {
      return;
    }

    cancelAnimationFrame(rafId!);

    rafId = undefined;

    window.removeEventListener('scroll', onScroll);

    window.removeEventListener('resize', onScroll);

    if (IS_RESIZE_OBSERVER_ENABLED) {
      observer!.disconnect();

      observer = undefined;
    } else {
      window.removeEventListener('orientationchange', onScroll);
    }

    onScroll = undefined;
  };

  return anchorParam;
};

export default trackScroll;
