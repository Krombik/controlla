import { FC, PropsWithChildren, SuspenseProps } from 'react';
import { AsyncState, ExtractErrors, Falsy } from '../types';
import Suspense from '../Suspense';
import useAll from '../useAll';
import awaitOnly from '../awaitOnly';
import { jsx } from 'react/jsx-runtime';

type Props<S extends Array<AsyncState | Falsy>> = PropsWithChildren & {
  states: S;
  renderIfError?:
    | ((errors: ExtractErrors<S>) => ReturnType<FC>)
    | ReturnType<FC>;
} & Pick<SuspenseProps, 'fallback'>;

const Controller: FC<Props<any[]>> = ({ states, renderIfError, children }) => {
  states = states.map((state) => state && awaitOnly(state));

  if (renderIfError === undefined) {
    useAll(states);

    return children;
  }

  const errors = useAll(states, true)[1];

  return errors.every((item) => item === undefined)
    ? children
    : typeof renderIfError == 'function'
      ? renderIfError(errors)
      : renderIfError;
};

/**
 * A controller component for rendering multiple {@link Props.states states} using `awaitOnly` to avoid unnecessary re-renders.
 * It utilizes the {@link useAll} hook under the hood to monitor the resolution or failure of all provided states.
 * This component integrates with the {@link Suspense} component, deferring rendering until all states are ready or an error occurs.
 */
const SuspenseOnlyAllController = <const S extends Array<AsyncState | Falsy>>(
  props: Props<S>
) => <Suspense fallback={props.fallback}>{jsx(Controller, props)}</Suspense>;

export default SuspenseOnlyAllController;
