import type { Lane, PrimitiveControlInternals } from '#internal/types';
import type { Control, ControlScope } from '#types';
import makePrimitiveInternals from '#internal/makePrimitiveInternals';
import createControl from '#core/createControl';
import setValue from '#core/setValue';
import scheduleMicrotask from '#internal/scheduleMicrotask';
import { INTERNALS, PASSIVE } from '#internal/constants';
import { EMPTY_OBJECT } from '#router/internal/constants';
import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import removeFromArray from '#internal/removeFromArray';

declare const ANCHOR_IDS: unique symbol;

export type AnchorScrollOptions = ScrollIntoViewOptions & {
  /** Distance in px to keep above the element (e.g. a sticky header height). */
  topOffset?: number;
  /** Distance in px to keep left of the element. */
  leftOffset?: number;
};

type GetOptions = (offsetEl: HTMLElement | null) => AnchorScrollOptions;

type Entry = {
  _id: string;
  _el: HTMLElement;
};

type Handle = {
  id: string;
  ref(el: HTMLElement | null): void;
};

// cross-cutting singletons (not per-route state)
let activeAnchor: AnchorParam | undefined;

let offsetEl: HTMLElement | null = null;

let isProgrammaticScroll = false;

const stopScrollSuppression = () => {
  isProgrammaticScroll = false;

  window.removeEventListener('scrollend', stopScrollSuppression);
};

const handles = new Map<string, Handle>();

const SPY_EVENTS = ['scroll', 'resize', 'orientationchange'] as const;

const returnDefaultOptions = () => EMPTY_OBJECT as AnchorScrollOptions;

const IS_SCROLLEND_AVAILABLE =
  typeof window != 'undefined' && 'onscrollend' in window;

const doScroll = (el: HTMLElement, getOptions: GetOptions) => {
  const options = getOptions(offsetEl);

  if (IS_SCROLLEND_AVAILABLE) {
    isProgrammaticScroll = true;

    window.addEventListener('scrollend', stopScrollSuppression, PASSIVE);
  }

  const x = window.scrollX;

  const y = window.scrollY;

  if (options.topOffset != null || options.leftOffset != null) {
    const rect = el.getBoundingClientRect();

    window.scrollTo({
      top: rect.top + y - (options.topOffset || 0),
      left: rect.left + x - (options.leftOffset || 0),
      behavior: options.behavior,
    });
  } else {
    // an empty dictionary has the same defaults as a bare call
    el.scrollIntoView(options);
  }

  // an instant scroll that didn't move fires no events at all — release now
  // (a plain no-op when nothing was suppressed)
  if (
    window.scrollX == x &&
    window.scrollY == y &&
    options.behavior != 'smooth'
  ) {
    stopScrollSuppression();
  }
};

export type AnchorParam<Ids extends string = string> = {
  /** @internal */
  _anchor: true;
  /** @internal */
  _trackScroll: boolean;
  /** @internal hash control internals; `_set` = raw `_enqueueSet` (the
   * router wraps the public one to sync the URL) */
  _hash: PrimitiveControlInternals & {
    _set?: PrimitiveControlInternals['_enqueueSet'];
  };
  /** @internal public hash control */
  _hashControl: Control<string>;
  /** @internal reactive set of mounted anchor ids */
  _registered: ControlScope<Record<string, true | undefined>>;
  /** @internal the anchor's scroll-options resolver */
  _getOptions: GetOptions;
  /** @internal mounted elements — unordered, the spy works on positions */
  _entries: Entry[];
  /** @internal pending scroll target awaiting its element */
  _pending?: string;
  /** @internal active scroll-spy teardown */
  _stopSpy: (() => void) | void;
  /** @internal becomes the active anchor; starts the spy when tracking */
  _activate(): void;
  /** @internal clears the hash, stops the spy, releases active */
  _clear(lane: Lane): void;
  /** @internal scrolls to the id, or defers until its element mounts */
  _scrollTo(id: string): void;
  [ANCHOR_IDS]: Ids;
};

/**
 * Declares that the path owns a hash anchor — place it last in `createPath`
 * (after `query`, before children). The route gains a hash control
 * (`selectHash`) settable via navigation or `setValue`/`replaceValue`; changing it
 * scrolls to the element registered with `registerAnchor` under that id.
 *
 * Pass {@link trackScroll} to keep the hash in sync with the scroll position
 * while the route is matched — the active section's id is written to the hash
 * control (no history entry). Combined with `selectRegisteredAnchors`, this
 * lets a navigation header show only mounted sections and highlight the
 * active one.
 *
 * {@link getOptions} sets the anchor's scroll options — an object, or a
 * resolver receiving the offset element (see `registerAnchorOffset`) called
 * at scroll time.
 *
 * @example
 * ```ts
 * createPath(
 *   'search',
 *   query({ q: true }),
 *   anchor<'filters' | 'results'>(true, (header) => ({
 *     topOffset: header ? header.offsetHeight : 0,
 *   }))
 * )
 * ```
 */
function anchorActivate(this: AnchorParam) {
  activeAnchor = this;

  if (this._trackScroll && !this._stopSpy) {
    const { _hash, _entries, _getOptions } = this;

    let rafId: number | undefined;

    const compute = () => {
      rafId = undefined;

      if (isProgrammaticScroll) {
        return;
      }

      const line = _getOptions(offsetEl).topOffset || 0;

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

        if (top <= 1 && top > bestTop) {
          bestTop = top;

          nextId = entry._id;
        }
      }

      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 1
      ) {
        nextId = lowestId;
      }

      const next = nextId || '';

      if (next !== _hash._value) {
        const lane = getSchedulerLane();

        _hash._set!(next, lane);

        scheduleFlush(lane);
      }
    };

    const onScroll = () => {
      rafId ??= requestAnimationFrame(compute);
    };

    for (let i = 0; i < SPY_EVENTS.length; i++) {
      window.addEventListener(SPY_EVENTS[i], onScroll, PASSIVE);
    }

    this._stopSpy = () => {
      cancelAnimationFrame(rafId!);

      for (let i = 0; i < SPY_EVENTS.length; i++) {
        window.removeEventListener(SPY_EVENTS[i], onScroll);
      }
    };
  }
}

function anchorClear(this: AnchorParam, lane: Lane) {
  this._hash._set!('', lane);

  this._stopSpy &&= this._stopSpy();

  if (activeAnchor == this) {
    activeAnchor = undefined;
  }
}

function anchorScrollTo(this: AnchorParam, id: string) {
  const entries = this._entries;

  for (let i = 0; i < entries.length; i++) {
    if (entries[i]._id == id) {
      this._pending = undefined;

      doScroll(entries[i]._el, this._getOptions);

      return;
    }
  }

  this._pending = id;
}

export const anchor = <Ids extends string = string>(
  trackScroll?: boolean,
  getOptions?: AnchorScrollOptions | GetOptions
): AnchorParam<Ids> => {
  const hash = makePrimitiveInternals('');

  if (typeof getOptions == 'object') {
    const options = getOptions;

    getOptions = () => options;
  }

  return {
    _anchor: true,
    _trackScroll: trackScroll || false,
    _hash: hash,
    _hashControl: { [INTERNALS]: hash } as unknown as Control<string>,
    _registered: createControl<Record<string, true | undefined>>({}),
    _getOptions: (getOptions as GetOptions) || returnDefaultOptions,
    _entries: [],
    _pending: undefined,
    _stopSpy: undefined,
    _activate: anchorActivate,
    _clear: anchorClear,
    _scrollTo: anchorScrollTo,
    // the ANCHOR_IDS brand is phantom
  } as Partial<AnchorParam<Ids>> as AnchorParam<Ids>;
};

/**
 * Registers an element as the scroll target for the given anchor {@link id} —
 * spread the result onto the element. Targets the currently matched anchor
 * route; scroll options come from the route's `anchor()` declaration.
 *
 * Returns a cached handle per id, safe to call during render.
 *
 * @example
 * ```tsx
 * <section {...registerAnchor('filters')} />
 * ```
 */
export const registerAnchor = (id: string) => {
  let handle = handles.get(id);

  if (!handle) {
    let boundTo: AnchorParam | undefined;

    let entry: Entry | undefined;

    handles.set(
      id,
      (handle = {
        id,
        ref(el) {
          if (el) {
            const anchorParam = activeAnchor;

            if (anchorParam) {
              boundTo = anchorParam;

              if (entry) {
                entry._el = el;
              } else {
                anchorParam._entries.push((entry = { _id: id, _el: el }));
              }

              setValue(anchorParam._registered[id], true);

              if (anchorParam._pending == id) {
                scheduleMicrotask(() => {
                  if (anchorParam._pending == id) {
                    anchorParam._scrollTo(id);
                  }
                });
              }
            }
          } else if (boundTo) {
            removeFromArray(boundTo._entries, entry!);

            setValue(boundTo._registered[id], undefined);

            boundTo = entry = undefined;
          }
        },
      })
    );
  }

  return handle;
};

/**
 * Registers the element the scroll-offset resolvers measure (e.g. a sticky
 * header) — pass its ref. Only one is tracked at a time.
 */
export const registerAnchorOffset = (el: HTMLElement | null) => {
  offsetEl = el;
};
