import type { FC } from 'react';
import type { AsyncState, State } from '../types';
import useValue from '../useValue';

type Props<S extends State> = {
  state: S;
  /** Function that renders the state’s value. */
  render(
    ...args: S extends AsyncState<infer V, infer E>
      ? [value: V | undefined, isLoaded: boolean, error: E | undefined]
      : S extends State<infer V>
        ? [value: V]
        : never
  ): ReturnType<FC>;
};

const Controller = (({ render, state }: Props<AsyncState>) =>
  render(
    useValue(state),
    render.length > 1 && useValue(state.isLoaded),
    render.length > 2 && useValue(state.error)
  )) as {
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
  <S extends State>(props: Props<S>): ReturnType<FC>;
};

export default Controller;
