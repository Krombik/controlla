import { FC } from 'react';
import { AsyncState, State } from '../types';
import useMappedValue from '../useMappedValue';

type Props<V, S extends State<any>, M extends (...args: any[]) => V> = {
  state: S;
  /** Function that maps the value from the state. */
  mapper: M;
  /** Function to render the mapped value. */
  render(value: V): ReturnType<FC>;
  /** Optional comparison function to determine if the next mapped value is equal to the previous. */
  isEqual?: (nextMappedValue: V, prevMappedValue: V) => boolean;
};

/** A controller that maps a value from state and passes it to a render function. Component wrapper of {@link useMappedValue} hook */
const MappedController: {
  <T, V, E>(
    props: Props<
      V,
      AsyncState<T, E>,
      (value: T | undefined, isLoaded: boolean, error: E | undefined) => V
    >
  ): ReturnType<FC>;
  <T, V>(props: Props<V, State<T>, (value: T) => V>): ReturnType<FC>;
} = (props: Props<any, AsyncState<any>, () => any>) =>
  props.render(useMappedValue(props.state, props.mapper, props.isEqual));

export default MappedController;
