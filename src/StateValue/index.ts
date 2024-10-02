import { FC } from 'react';
import { AsyncState, HandlePending, State } from '../types';
import useValue from '../useValue';

export type StateValueProps<S extends State<any>> = {
  state: S;
  render: S extends State<infer V>
    ? (value: HandlePending<V>) => ReturnType<FC>
    : never;
} & (S extends AsyncState<any, infer E>
  ? {
      renderIfError?: ((error: E) => ReturnType<FC>) | ReturnType<FC>;
    }
  : {});

const StateValue: {
  <S extends State<any>>(props: StateValueProps<S>): ReturnType<FC>;
  /** @internal */
  (props: StateValueProps<AsyncState<any>>): ReturnType<FC>;
} = ({ render, state, renderIfError }: StateValueProps<AsyncState<any>>) => {
  const err =
    renderIfError !== undefined && state.error
      ? useValue(state.error)
      : undefined;

  const value = useValue(state);

  return err === undefined
    ? render(value)
    : typeof renderIfError == 'function'
      ? renderIfError!(err)
      : renderIfError || null;
};

export default StateValue;
