import { FC } from 'react';
import { AsyncState, State } from '../types';
import useMappedValue from '../useMappedValue';

type Props<S extends State, V> = {
  state: S;
  /** Function that maps the {@link Props.state state’s} value. */
  mapper(
    ...args: S extends AsyncState<infer T, infer E>
      ? [value: T | undefined, isLoaded: boolean, error: E | undefined]
      : S extends State<infer T>
        ? [value: T]
        : never
  ): V;
  /** Function to render the mapped value. */
  render(mappedValue: V): ReturnType<FC>;
  /** Optional comparison function to determine if the next mapped value is equal to the previous. */
  isEqual?(nextMappedValue: V, prevMappedValue: V): boolean;
};

const MappedController: {
  /**
   * A controller that {@link mapper maps} a value from {@link Props.state state} and passes it to a {@link Props.render render} function.
   * This component serves as a wrapper for the {@link useMappedValue} hook.
   * @example
   * ```jsx
   * <MappedController
   *   state={state}
   *   mapper={(value) => value % 2}
   *   render={(isEven) => <span>{isEven ? 'even' : 'odd'}</span>}
   * />
   *
   * <MappedController
   *   state={asyncState}
   *   mapper={(value, isLoaded) => !isLoaded || !!value }
   *   render={(isRenderable) => isRenderable && <Component />}
   * />
   * ```
   */
  <S extends State, V>(props: Props<S, V>): ReturnType<FC>;
} = (props: Props<any, any>) =>
  props.render(useMappedValue(props.state, props.mapper, props.isEqual));

export default MappedController;
