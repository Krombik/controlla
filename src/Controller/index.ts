import { useSyncExternalStore, type FC } from 'react';
import type { AsyncState, ReadonlyState } from '../types';
import useValue from '../useValue';
import { ROOT } from '../utils/constants';

type Props<S extends ReadonlyState> = {
  state: S;
  /** Function that renders the state’s value. */
  render(
    ...args: S extends AsyncState<infer V, infer E>
      ? [value: V | undefined, isLoaded: boolean, error: E | undefined]
      : S extends ReadonlyState<infer V>
        ? [value: V]
        : never
  ): ReturnType<FC>;
};

const Controller = (({ render, state }: Props<AsyncState>) => {
  const utils = state[ROOT];

  const l = render.length;

  if (l < 2) {
    useSyncExternalStore(
      utils._subscribeWithLoad || utils._onValueChange,
      () => utils._valueToggler
    );

    return (render as Function)(utils._get());
  }

  const root = utils[ROOT];

  const isLoadedState = root._isLoadedState[ROOT];

  useSyncExternalStore(
    isLoadedState._onValueChange,
    () => isLoadedState._valueToggler
  );

  if (l < 3) {
    useSyncExternalStore(
      utils._subscribeWithLoad || utils._onValueChange,
      () => utils._valueToggler
    );

    return (render as Function)(utils._get(), isLoadedState._value);
  }

  const errorState = root._errorState[ROOT];

  useSyncExternalStore(
    utils._subscribeWithError,
    () => (errorState._valueToggler << 1) | utils._valueToggler
  );

  return render(utils._get(), isLoadedState._value, errorState._value);
}) as {
  /**
   * A controller component that renders the value from the given {@link Props.state state}.
   * This component wraps the {@link useValue} hook and provides a flexible way
   * to render state values along with their loading and error statuses when applicable.
   * @example
   * ```jsx
   * <Controller
   *   state={state}
   *   render={(value) => <div>{value}</div>}
   * />
   *
   * <Controller
   *   state={asyncState}
   *   render={(value, isLoaded, error) => (
   *     <div>
   *       {isLoaded ? (
   *         error ? <span>Error: {error}</span> : <span>Value: {value}</span>
   *       ) : (
   *         <span>Loading...</span>
   *       )}
   *     </div>
   *   )}
   * />
   * ```
   */
  <S extends ReadonlyState>(props: Props<S>): ReturnType<FC>;
};

export default Controller;
