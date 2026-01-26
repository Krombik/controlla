import { type ReactNode, useSyncExternalStore } from 'react';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import type useValue from '#@/useValue';
import { INTERNALS } from '#shared-internal/constants';
import { AsyncRootNode, RenderablePrimitives } from '#internal/types';

type RenderProps<S extends ReadonlyControl> = {
  control: S;
  /** Function that renders the control’s value. */
  render(
    ...args: S extends ReadonlyAsyncControl<infer V, infer E>
      ? [value: V | undefined, isLoading: boolean, error: E | undefined]
      : S extends ReadonlyControl<infer V>
        ? [value: V]
        : never
  ): ReactNode;
  children?: never;
};

type TruthyGateProps = {
  control: ReadonlyControl<boolean | RenderablePrimitives>;
  children: ReactNode;
  render?: never;
};

type PrimitiveDisplayProps = {
  control: ReadonlyControl<RenderablePrimitives | Array<RenderablePrimitives>>;
  render?: never;
  children?: never;
};

const ControlConsumer = ((
  props:
    | RenderProps<ReadonlyAsyncControl>
    | TruthyGateProps
    | PrimitiveDisplayProps
) => {
  const utils = props.control[INTERNALS];

  const value = utils._get();

  useSyncExternalStore(utils._subscribe, () => utils._versionToggle);

  if ('render' in props) {
    const render = props.render!;

    const l = render.length;

    if (l < 2) {
      return (render as Function)(value);
    }

    const root = utils._root as AsyncRootNode;

    const loadingControl = root._loadingControl[INTERNALS];

    const loading = useSyncExternalStore(
      loadingControl._subscribe,
      () => loadingControl._versionToggle
    );

    if (l < 3) {
      return (render as Function)(value, loading);
    }

    const errorControl = root._errorControl[INTERNALS];

    useSyncExternalStore(
      errorControl._subscribe,
      () => errorControl._versionToggle
    );

    return render(value, loading, errorControl._value);
  }

  if ('children' in props) {
    return value ? props.children : null;
  }

  return value;
}) as {
  /**
   * A controller component that renders the value from the given {@link RenderProps.control control}.
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
  <S extends ReadonlyControl>(props: RenderProps<S>): ReactNode;
  (props: TruthyGateProps): ReactNode;
  (props: PrimitiveDisplayProps): ReactNode;
};

export default ControlConsumer;
