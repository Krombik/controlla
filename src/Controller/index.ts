import { FC } from 'react';
import { AsyncState, HandlePending, State } from '../types';
import useValue from '../useValue';

type Props<S extends State<any>> = {
  state: S;
  /** Function that renders the value of the state. */
  render: S extends State<infer V>
    ? (value: HandlePending<V>) => ReturnType<FC>
    : never;
} & (S extends AsyncState<any, infer E>
  ? {
      /** Function or component to render in case of an error */
      renderIfError?: ((error: E) => ReturnType<FC>) | ReturnType<FC>;
    }
  : {});

/** A controller that renders the value from state. Component wrapper of {@link useValue} hook */
const Controller: {
  <S extends State<any>>(props: Props<S>): ReturnType<FC>;
  /** @internal */
  (props: Props<AsyncState<any>>): ReturnType<FC>;
} = ({ render, state, renderIfError }: Props<AsyncState<any>>) => {
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

export default Controller;
