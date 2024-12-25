import type { FC, SuspenseProps } from 'react';
import type {
  AsyncState,
  ContainerType,
  ExtractErrors,
  ExtractValues,
  Falsy,
} from '../types';
import Suspense from '../Suspense';
import useAll from '../useAll';
import { jsx } from 'react/jsx-runtime';
import handleContainerChildren from '../utils/handleContainerChildren';

type Props<S extends Array<AsyncState | Falsy>> = {
  states: S;
  /** A function to render the final content when all {@link Props.states states} resolve successfully. */
  render(values: ExtractValues<S>): ReturnType<FC>;
  /** A function or element to render if any of the {@link Props.states states} fail */
  renderIfError?:
    | ((
        errors: ExtractErrors<S>,
        values: ExtractValues<S, true>
      ) => ReturnType<FC>)
    | ReturnType<FC>;
  /** If provided, it wraps the rendered content or fallback only if they exist. */
  container?: ContainerType;
} & Pick<SuspenseProps, 'fallback'>;

const Controller: FC<Props<any[]>> = ({
  render,
  states,
  renderIfError,
  container,
}) => {
  if (renderIfError === undefined) {
    return handleContainerChildren(container, render(useAll(states)));
  }

  const [values, errors] = useAll(states, true);

  return handleContainerChildren(
    container,
    errors.every((item) => item === undefined)
      ? render(values)
      : typeof renderIfError == 'function'
        ? renderIfError(errors, values)
        : renderIfError
  );
};

/**
 * A controller component for rendering multiple {@link Props.states states}.
 * It utilizes the {@link useAll} hook under the hood to collect the values or errors of all provided states.
 * This component integrates with the {@link Suspense} component, deferring rendering until all states are resolved or an error occurs.
 *
 * @example
 * ```jsx
 *   <SuspenseAllController
 *     states={[asyncState1, asyncState2]}
 *     container="div"
 *     fallback={<div>Loading...</div>}
 *     render={(data1, data2) => (
 *       <div>
 *         <div>Data 1: {JSON.stringify(data1)}</div>
 *         <div>Data 2: {JSON.stringify(data2)}</div>
 *       </div>
 *     )}
 *     renderIfError={(values, errors) => (
 *       <div>Error occurred: {errors.map((error, index) => (
 *         <div key={index}>Error {index + 1}: {error?.message}</div>
 *       ))}</div>
 *     )}
 *   />
 * ```
 */
const SuspenseAllController = <const S extends Array<AsyncState | Falsy>>(
  props: Props<S>
) => (
  <Suspense fallback={handleContainerChildren(props.container, props.fallback)}>
    {jsx(Controller, props)}
  </Suspense>
);

export default SuspenseAllController;
