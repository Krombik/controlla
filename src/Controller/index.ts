import { type ReactNode, useSyncExternalStore } from 'react';
import type { ReadonlyAsyncControl, ReadonlyControl } from '../types';
import useValue from '../useValue';
import { ROOT } from '../utils/constants';

type Props<S extends ReadonlyControl> = {
  control: S;
  /** Function that renders the control’s value. */
  render(
    ...args: S extends ReadonlyAsyncControl<infer V, infer E>
      ? [value: V | undefined, isLoaded: boolean, error: E | undefined]
      : S extends ReadonlyControl<infer V>
        ? [value: V]
        : never
  ): ReactNode;
};

const Controller = (({ render, control }: Props<ReadonlyAsyncControl>) => {
  const utils = control[ROOT];

  const l = render.length;

  if (l < 2) {
    useSyncExternalStore(
      utils._subscribeWithLoad || utils._subscribe,
      () => utils._valueToggler
    );

    return (render as Function)(utils._get());
  }

  const root = utils[ROOT];

  const isLoadedControl = root._isLoadedControl[ROOT];

  useSyncExternalStore(
    isLoadedControl._subscribe,
    () => isLoadedControl._valueToggler
  );

  if (l < 3) {
    useSyncExternalStore(
      utils._subscribeWithLoad || utils._subscribe,
      () => utils._valueToggler
    );

    return (render as Function)(utils._get(), isLoadedControl._value);
  }

  const errorControl = root._errorControl[ROOT];

  useSyncExternalStore(
    utils._subscribeWithError,
    () => (errorControl._valueToggler << 1) | utils._valueToggler
  );

  return render(utils._get(), isLoadedControl._value, errorControl._value);
}) as {
  /**
   * A controller component that renders the value from the given {@link Props.control control}.
   * This component wraps the {@link useValue} hook and provides a flexible way
   * to render control values along with their loading and error statuses when applicable.
   * @example
   * ```jsx
   * <Controller
   *   control={control}
   *   render={(value) => <div>{value}</div>}
   * />
   *
   * <Controller
   *   control={asyncControl}
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
  <S extends ReadonlyControl>(props: Props<S>): ReactNode;
};

export default Controller;
