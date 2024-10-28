import type { State } from '../types';

/**
 * Generates dependencies from the given {@link State} instance for use in hooks like {@link React.useEffect}.
 *
 * @example
 * ```js
 * useEffect(
 *   () =>
 *     onValueChange(state, (value) => {
 *       console.log(value);
 *     }),
 *   toDeps(state)
 * );
 * ```
 */
const toDeps = (state: State): [{}, string | undefined] => [
  state._internal,
  state._path && state._path.join('.'),
];

export default toDeps;
