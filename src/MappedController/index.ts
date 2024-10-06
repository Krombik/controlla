import { FC } from 'react';
import { AsyncState, State } from '../types';
import useMappedValue from '../useMappedValue';

type StateProps<T, V> = {
  state: State<T>;
  mapper: (value: T) => V;
};

type AsyncStateProps<T, V, E = any> = {
  state: AsyncState<T, E>;
  mapper: (value: T | undefined, isLoaded: boolean, error: E | undefined) => V;
};

type Props<V> = {
  render(value: V): ReturnType<FC>;
  isEqual?: (nextMappedValue: V, prevMappedValue: V) => boolean;
};

const MappedController: {
  <T, V, E>(props: AsyncStateProps<T, V, E> & Props<V>): ReturnType<FC>;
  <T, V>(props: StateProps<T, V> & Props<V>): ReturnType<FC>;
} = (
  props: (AsyncStateProps<any, any, any> | StateProps<any, any>) & Props<any>
) =>
  props.render(
    useMappedValue(props.state as AsyncState<any>, props.mapper, props.isEqual)
  );

export default MappedController;
