import { sourceUpdate } from '#internal/sourceUpdate';

/**
 * Whether the change being handled right now came from somewhere else rather
 * than from a `setValue`:
 *
 * - a value a loader handed over, the first one and every one after it
 * - a derived control recomputing because its sources moved
 * - route params, and the routes' matched state, following a back/forward
 * - a bound control whose target or key moved for any of those reasons
 * - an external storage the control is backed by, written in another tab
 * - the DOM ones: `$online`, `$pageVisible`, `$windowSize`, `mediaQuery`
 *
 * Made for submit-on-change: a reload answering with values the server changed
 * has to reach the fields without being taken for an edit and submitted again.
 *
 * Only meaningful while a listener is running; anywhere else it is `false`.
 * `watchValues` reports one answer for the whole tuple, so a flush carrying
 * both a load and an edit reads as the source's.
 *
 * An async control with no `load`, written from outside with `setValue`, reads
 * as an edit - a loader is what tells the two apart.
 *
 * @example
 * ```ts
 * const $form = createAsyncDerivedControl($server, (data) => ({ ...data }));
 *
 * // the reload after a save updates the fields, it doesn't save again
 * watchValue($form, (values) => {
 *   if (!isSourceUpdate()) {
 *     save(values).then(() => invalidate($server));
 *   }
 * });
 * ```
 */
const isSourceUpdate = () => sourceUpdate._value;

export default isSourceUpdate;
