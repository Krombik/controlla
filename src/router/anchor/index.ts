import type { PrimitiveControlInternals } from '#internal/types';
import type { ControlScope, ReadonlyControl } from '#types';
import makePrimitiveInternals from '#internal/makePrimitiveInternals';
import createControl from '#core/createControl';
import setValue from '#core/setValue';
import { INTERNALS } from '#internal/constants';

declare const ANCHOR_IDS: unique symbol;

export type AnchorScrollOptions = ScrollIntoViewOptions & {
  /** Distance in px to keep above the element (e.g. a sticky header height). */
  topOffset?: number;
  /** Distance in px to keep left of the element. */
  leftOffset?: number;
};

type Options =
  | AnchorScrollOptions
  | ((offsetEl: HTMLElement | null) => AnchorScrollOptions);

type Enqueue = (
  internals: Pick<PrimitiveControlInternals, '_enqueueSet'>,
  value: any,
  lane?: any
) => void;

type Entry = { _el: HTMLElement | null; _getOptions: Options | undefined };

type Handle = {
  id: string;
  ref(el: HTMLElement | null): void;
  /** @internal anchor this handle's element is currently bound to */
  _boundTo?: AnchorParam;
  /** @internal latest resolver, applied to the live entry */
  _getOptions?: Options;
};

// cross-cutting singletons (not per-route state)
let activeAnchor: AnchorParam | undefined;

let offsetEl: HTMLElement | null = null;

let isProgrammaticScroll = false;

let programmaticScrollTimer: ReturnType<typeof setTimeout> | undefined;

const handles = new Map<string, Handle>();

const resolveOptions = (getOptions: Options | undefined) =>
  typeof getOptions == 'function' ? getOptions(offsetEl) : getOptions;

const doScroll = (el: HTMLElement, getOptions: Options | undefined) => {
  const options = resolveOptions(getOptions);

  isProgrammaticScroll = true;

  clearTimeout(programmaticScrollTimer);

  // spy stays suppressed until the scroll settles, with a timeout fallback
  programmaticScrollTimer = setTimeout(() => {
    isProgrammaticScroll = false;
  }, 1000);

  if (options && (options.topOffset != null || options.leftOffset != null)) {
    const rect = el.getBoundingClientRect();

    window.scrollTo({
      top: rect.top + window.scrollY - (options.topOffset || 0),
      left: rect.left + window.scrollX - (options.leftOffset || 0),
      behavior: options.behavior,
    });
  } else {
    el.scrollIntoView(options || undefined);
  }
};

export type AnchorParam<Ids extends string = string> = {
  /** @internal */
  _anchor: true;
  /** @internal */
  _trackScroll: boolean;
  /** @internal hash control internals */
  _hash: PrimitiveControlInternals;
  /** @internal public hash control */
  _hashControl: ReadonlyControl<string | undefined>;
  /** @internal reactive set of mounted anchor ids */
  _registered: ControlScope<Record<string, true | undefined>>;
  /** @internal mounted elements by id */
  _entries: Map<string, Entry>;
  /** @internal pending scroll target awaiting its element */
  _pending?: string;
  /** @internal active scroll-spy teardown */
  _stopSpy?: () => void;
  /** @internal commits the resolved hash to the control */
  _set(hash: string | undefined, enqueue: Enqueue, lane?: any): void;
  /** @internal current committed hash */
  _get(): string | undefined;
  /** @internal commits the URL hash on match (direct on initial match) and scrolls */
  _commit(
    urlHash: string | undefined,
    enqueue: Enqueue,
    isInitial: boolean
  ): void;
  /** @internal becomes the active anchor; starts the spy when tracking */
  _activate(enqueue: Enqueue): void;
  /** @internal clears the hash, stops the spy, releases active */
  _clear(enqueue: Enqueue, lane?: any): void;
  /** @internal scrolls to the id, or defers until its element mounts */
  _scrollTo(id: string): void;
  [ANCHOR_IDS]: Ids;
};

/**
 * Declares that the path owns a hash anchor — place it last in `createPath`
 * (after `query`, before children). The route gains a hash control
 * (`selectHash`) settable via navigation or `updateParams`; changing it
 * scrolls to the element registered with `registerAnchor` under that id.
 *
 * Pass {@link trackScroll} to keep the hash in sync with the scroll position
 * while the route is matched — the active section's id is written to the hash
 * control (no history entry). Combined with `selectRegisteredAnchors`, this
 * lets a navigation header show only mounted sections and highlight the
 * active one.
 *
 * @example
 * ```ts
 * createPath('search', query({ q: true }), anchor<'filters' | 'results'>(true))
 * ```
 */
const anchor = <Ids extends string = string>(
  trackScroll?: boolean
): AnchorParam<Ids> => {
  const hash = makePrimitiveInternals(undefined);

  const entries = new Map<string, Entry>();

  const self = {
    _anchor: true,
    _trackScroll: trackScroll || false,
    _hash: hash,
    _hashControl: { [INTERNALS]: hash } as ReadonlyControl<string | undefined>,
    _registered: createControl<Record<string, true | undefined>>({}),
    _entries: entries,
    _set(value, enqueue, lane) {
      enqueue(hash, value, lane);
    },
    _get: () => hash._value,
    _commit(urlHash, enqueue, isInitial) {
      if (isInitial) {
        // runs before any listener can exist — write directly
        hash._value = urlHash;
      } else {
        enqueue(hash, urlHash);
      }

      if (urlHash !== undefined) {
        self._scrollTo(urlHash);
      }
    },
    _activate(enqueue) {
      activeAnchor = self;

      if (self._trackScroll && !self._stopSpy) {
        let rafId: number | undefined;

        let activeId: string | undefined;

        const compute = () => {
          rafId = undefined;

          if (isProgrammaticScroll) {
            return;
          }

          let nextId: string | undefined;

          let bestTop = -Infinity;

          let lastId: string | undefined;

          entries.forEach((entry, id) => {
            const el = entry._el;

            if (el) {
              lastId = id;

              const options = resolveOptions(entry._getOptions);

              const line = (options && options.topOffset) || 0;

              const top = el.getBoundingClientRect().top - line;

              // last element whose line has been crossed (top <= 0)
              if (top <= 1 && top > bestTop) {
                bestTop = top;

                nextId = id;
              }
            }
          });

          // scrolled to the bottom — activate the last section
          if (
            window.innerHeight + window.scrollY >=
            document.documentElement.scrollHeight - 1
          ) {
            nextId = lastId;
          }

          if (nextId != activeId) {
            activeId = nextId;

            enqueue(hash, nextId);
          }
        };

        const onScroll = () => {
          if (rafId == null) {
            rafId = requestAnimationFrame(compute);
          }
        };

        window.addEventListener('scroll', onScroll, { passive: true });

        window.addEventListener('resize', onScroll, { passive: true });

        self._stopSpy = () => {
          if (rafId != null) {
            cancelAnimationFrame(rafId);
          }

          window.removeEventListener('scroll', onScroll);

          window.removeEventListener('resize', onScroll);
        };
      }
    },
    _clear(enqueue, lane) {
      enqueue(hash, undefined, lane);

      if (self._stopSpy) {
        self._stopSpy();

        self._stopSpy = undefined;
      }

      if (activeAnchor == self) {
        activeAnchor = undefined;
      }
    },
    _scrollTo(id) {
      const entry = entries.get(id);

      if (entry && entry._el) {
        self._pending = undefined;

        doScroll(entry._el, entry._getOptions);
      } else {
        self._pending = id;
      }
    },
  } as AnchorParam<Ids>;

  return self;
};

/**
 * Registers an element as the scroll target for the given anchor {@link id} —
 * spread the result onto the element. The optional {@link getOptions} either
 * is the scroll options or a resolver receiving the registered offset element
 * (see {@link registerAnchorOffset}), called at scroll time. Targets the
 * currently matched anchor route.
 *
 * Returns a cached handle per id, safe to call during render.
 *
 * @example
 * ```tsx
 * <section {...registerAnchor('filters', (header) => ({ topOffset: header?.offsetHeight }))} />
 * ```
 */
export const registerAnchor = (id: string, getOptions?: Options) => {
  let handle = handles.get(id);

  if (handle) {
    handle._getOptions = getOptions;

    const boundTo = handle._boundTo;

    if (boundTo) {
      const entry = boundTo._entries.get(id);

      if (entry) {
        entry._getOptions = getOptions;
      }
    }
  } else {
    handles.set(
      id,
      (handle = {
        id,
        _getOptions: getOptions,
        ref(el) {
          if (el) {
            const anchorParam = activeAnchor;

            if (anchorParam) {
              handle!._boundTo = anchorParam;

              anchorParam._entries.set(id, {
                _el: el,
                _getOptions: handle!._getOptions,
              });

              setValue(anchorParam._registered[id], true);

              if (anchorParam._pending == id) {
                anchorParam._scrollTo(id);
              }
            }
          } else {
            const boundTo = handle!._boundTo;

            if (boundTo) {
              boundTo._entries.delete(id);

              setValue(boundTo._registered[id], undefined);

              handle!._boundTo = undefined;
            }
          }
        },
      })
    );
  }

  return { id: handle.id, ref: handle.ref };
};

/**
 * Registers the element the scroll-offset resolvers measure (e.g. a sticky
 * header) — pass its ref. Only one is tracked at a time.
 */
export const registerAnchorOffset = (el: HTMLElement | null) => {
  offsetEl = el;
};

export default anchor;
