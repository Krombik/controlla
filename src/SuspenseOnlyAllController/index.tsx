import type { FC, PropsWithChildren, SuspenseProps } from 'react';
import type { AsyncState, ExtractErrors, Falsy } from '../types';
import Suspense from '../Suspense';
import useAll from '../useAll';
import awaitOnly from '../awaitOnly';
import { jsx } from 'react/jsx-runtime';

type Props<S extends Array<AsyncState | Falsy>> = PropsWithChildren & {
  states: S;
  /** A function or element to render if any of the {@link Props.states states} fail. */
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
 * It utilizes the {@link useAll} hook under the hood to monitor the resolution or failure of all provided {@link Props.states states}.
 * This component integrates with the {@link Suspense} component, deferring rendering until all {@link Props.states states} are ready or an error occurs.
 *
 * @example
 * ```jsx
 *   <SuspenseOnlyAllController
 *     states={[asyncState1, asyncState2]}
 *     fallback={<div>Loading...</div>}
 *     renderIfError={(errors) => (
 *       <div>Error occurred: {errors.map((error, index) => (
 *         <div key={index}>Error {index + 1}: {error?.message}</div>
 *       ))}</div>
 *     )}
 *   >
 *     <div>All data has loaded successfully!</div>
 *   </SuspenseOnlyAllController>
 * ```
 */
const SuspenseOnlyAllController = <const S extends Array<AsyncState | Falsy>>(
  props: Props<S>
) => <Suspense fallback={props.fallback}>{jsx(Controller, props)}</Suspense>;

export default SuspenseOnlyAllController;
