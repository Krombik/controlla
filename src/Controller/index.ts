import { FC } from 'react';
import { AsyncState, State } from '../types';
import useValue from '../useValue';

type Props<S extends State<any>> = {
  state: S;
  /** Function that renders the value of the state. */
  render(
    ...args: S extends AsyncState<infer V, infer E>
      ? [value: V | undefined, isLoaded: boolean, error: E | undefined]
      : S extends State<infer V>
        ? [value: V]
        : never
  ): ReturnType<FC>;
};

/** A controller that renders the value from state. Component wrapper of {@link useValue} hook */
const Controller: {
  <S extends State<any>>(props: Props<S>): ReturnType<FC>;
  /** @internal */
  (props: Props<AsyncState<any>>): ReturnType<FC>;
} = ({ render, state }: Props<AsyncState<any>>) =>
  render(
    useValue(state),
    render.length > 1 && useValue(state.isLoaded),
    render.length > 2 && useValue(state.error)
  );

export default Controller;
