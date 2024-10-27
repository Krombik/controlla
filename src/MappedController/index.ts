import { FC } from 'react';
import { AsyncState, State } from '../types';
import useMappedValue from '../useMappedValue';

type Props<S extends State, V> = {
  state: S;
  /** Function that maps the value from the state. */
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
  /** A controller that maps a value from state and passes it to a render function. Component wrapper of {@link useMappedValue} hook */
  <S extends State, V>(props: Props<S, V>): ReturnType<FC>;
} = (props: Props<any, any>) =>
  props.render(useMappedValue(props.state, props.mapper, props.isEqual));

export default MappedController;
