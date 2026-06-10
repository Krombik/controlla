import { type ReactNode, useLayoutEffect, useReducer } from 'react';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import type useValue from '#@/useValue';
import { INTERNALS } from '#shared-internal/constants';
import { AsyncControlInternals, RenderablePrimitives } from '#internal/types';
import forceRerenderReducer from '#internal/forceRerenderReducer';
import useInternalsValue from '#internal/useInternalsValue';

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
  const forceRerender = useReducer(forceRerenderReducer, 0)[1];

  const internals = props.control[INTERNALS];

  const l = 'render' in props ? (props.render!.length as 1 | 2 | 3) : 0;

  let value: any;

  if (l < 2) {
    value = useInternalsValue(internals, forceRerender);

    if (l) {
      return (props.render! as Function)(value);
    }
  } else {
    const root = internals._root as AsyncControlInternals;

    const loadingInternals = root._loadingControl[INTERNALS];

    const isLoading = loadingInternals._value;

    value = internals._get();

    if (l == 2) {
      useLayoutEffect(() => {
        root._attach(internals, forceRerender, true);

        root._attach(loadingInternals, forceRerender, false);

        if (
          value !== internals._get() ||
          isLoading != loadingInternals._value
        ) {
          forceRerender();
        }

        return () => {
          root._detach(internals, forceRerender, true);

          root._detach(loadingInternals, forceRerender, false);
        };
      }, [internals]);

      return (props.render! as Function)(value, isLoading);
    }

    const errInternals = root._errorControl[INTERNALS];

    const err = errInternals._value;

    useLayoutEffect(() => {
      root._attach(internals, forceRerender, true);

      root._attach(loadingInternals, forceRerender, false);

      errInternals._attach(errInternals, forceRerender, false);

      if (
        value !== internals._get() ||
        isLoading != loadingInternals._value ||
        err !== errInternals._value
      ) {
        forceRerender();
      }

      return () => {
        root._detach(internals, forceRerender, true);

        root._detach(loadingInternals, forceRerender, false);

        errInternals._detach(errInternals, forceRerender, false);
      };
    }, [internals]);

    return props.render!(value, isLoading, err);
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
