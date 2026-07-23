import type { Control } from '#types';
import makePrimitiveInternals from '#internal/makePrimitiveInternals';
import createControl from '#core/createControl';
import noop from '#internal/noop';
import { INTERNALS } from '#internal/constants';
import { EMPTY_OBJECT, ONCE_PASSIVE } from '#router/internal/constants';
import type { AnchorParam, AnchorScrollOptions } from '#router/internal/types';

type GetAnchorScrollOptions<Ids extends string = string> = (
  offsetEl: HTMLElement | null,
  id: Ids
) => AnchorScrollOptions;

const returnDefaultOptions = () => EMPTY_OBJECT as AnchorScrollOptions;

function anchorScrollTo(this: AnchorParam, id: string, instant?: boolean) {
  const self = this;

  const entries = self._entries;

  for (let i = 0; i < entries.length; i++) {
    const item = entries[i];

    if (item._id == id) {
      const el = item._el;

      let options = self._getOptions(self._offsetEl, id);

      if (instant) {
        options = { ...options, behavior: 'instant' };
      }

      self._onScrollStart(id, options);

      if (options.topOffset != null || options.leftOffset != null) {
        const rect = el.getBoundingClientRect();

        window.scrollTo({
          top: rect.top + window.scrollY - (options.topOffset || 0),
          left: rect.left + window.scrollX - (options.leftOffset || 0),
          behavior: options.behavior,
        });
      } else {
        el.scrollIntoView(options);
      }

      return;
    }
  }
}

function activate(this: AnchorParam) {
  this._isPending = true;

  window.addEventListener(
    'scroll',
    () => {
      this._isPending = false;
    },
    ONCE_PASSIVE
  );

  this._startTrack();
}

/**
 * Declares that the path owns a hash anchor. Place it last in `createPath`
 * (after `query`, before children). The route gains an anchor control
 * (`selectAnchor`), stored in the URL as its hash: writing to it with
 * `setValue`/`replaceValue`, or navigating with an anchor argument, scrolls
 * to the element registered with `registerAnchor` under that id. If the
 * element isn't mounted yet (the page is still loading), the scroll retries,
 * instantly, once it mounts, unless the user has scrolled in the meantime.
 * An empty string clears the URL's hash without scrolling (leaving
 * `undefined`/no argument alone leaves it untouched).
 *
 * `selectRegisteredAnchors` is a reactive set of the currently mounted ids.
 * Wrap the result with `controlla/router/trackScroll` to additionally mark
 * whichever one is actually scrolled to as `'active'`, and keep that in
 * sync as the user scrolls. It's a separate import, so apps that don't use
 * it don't bundle the scroll-spy code.
 *
 * {@link options} sets the anchor's scroll options: an object, or a
 * resolver receiving the offset element (see `registerAnchorOffset`) and the
 * target id, called at scroll time.
 *
 * @example
 * ```ts
 * import anchor from 'controlla/router/anchor';
 * import trackScroll from 'controlla/router/trackScroll';
 *
 * createPath(
 *   'search',
 *   query({ q: true }),
 *   trackScroll(
 *     anchor<'filters' | 'results'>((header) => ({
 *       topOffset: header ? header.offsetHeight : 0,
 *     }))
 *   )
 * )
 * ```
 */
export const anchor = <Ids extends string = string>(
  options?: AnchorScrollOptions | GetAnchorScrollOptions<Ids>
): AnchorParam<Ids> => {
  const hash = makePrimitiveInternals('');

  return {
    _onScrollStart: noop,
    _anchor: true,
    _hash: hash,
    _hashControl: { [INTERNALS]: hash } as unknown as Control<string>,
    _registered: createControl<Record<string, 'active' | true | undefined>>({}),
    _activeId: undefined,
    _getOptions: options
      ? typeof options == 'object'
        ? () => options
        : options
      : returnDefaultOptions,
    _offsetEl: null,
    _offsetRef: undefined,
    _entries: [],
    _handles: new Map(),
    _isPending: true,
    _activate: activate,
    _startTrack: noop,
    _clear: noop,
    _scrollTo: anchorScrollTo,
  } as Partial<AnchorParam<Ids>> as AnchorParam<Ids>;
};

export default anchor;

export type { AnchorParam, AnchorScrollOptions } from '#router/internal/types';
