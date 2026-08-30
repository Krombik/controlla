import { historyState } from '#router/internal/state';

/**
 * Moves through the app's own history the way `history.go` does - `-1` is the
 * back button, `1` the forward one. An enabled `navigationBlocker` parks the
 * move like any other navigation.
 *
 * Returns `false` when there is no such entry and nothing moved: going back
 * past where the app started would leave it, which is a decision only the app
 * can make. React Native has no back button of its own to fall back on, so a
 * screen offering one needs this; on Android the hardware button already does
 * `go(-1)`, and leaves the app when that answers `false`.
 *
 * @example
 * ```tsx
 * <button onClick={() => go(-1)}>back</button>
 * ```
 */
const go = (delta: number) => {
  const index = historyState._index + delta;

  // forward past the last entry is knowable only where the stack is ours
  if (
    !delta ||
    index < 0 ||
    (__NATIVE__ && index >= historyState._entries.length)
  ) {
    return false;
  }

  if (__NATIVE__) {
    historyState._pop(index);
  } else {
    history.go(delta);
  }

  return true;
};

export default go;
