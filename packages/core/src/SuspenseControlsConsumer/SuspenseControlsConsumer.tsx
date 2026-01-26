import type { FC, ReactNode, SuspenseProps } from 'react';
import type {
  ContainerComponent,
  ExtractErrors,
  ExtractValues,
  Falsy,
} from '#internal/types';
import Suspense from '#@/Suspense';
import useSuspenseValues from '#@/useSuspenseValues';
import { jsx } from 'react/jsx-runtime';
import wrapWithContainer from '#internal/wrapWithContainer';
import type { ReadonlyAsyncControl } from '#types';

type Props<S extends Array<ReadonlyAsyncControl | Falsy>> = {
  controls: S;
  /** A function to render the final content when all {@link Props.controls controls} resolve successfully. */
  render(...values: ExtractValues<S>): ReactNode;
  /** A function or element to render if any of the {@link Props.controls controls} fail */
  renderIfError?:
    | ((errors: ExtractErrors<S>, values: ExtractValues<S, true>) => ReactNode)
    | ReactNode;
  /** If provided, it wraps the rendered content or fallback only if they exist. */
  container?: ContainerComponent;
} & Pick<SuspenseProps, 'fallback'>;

const SuspendingControlsConsumer: FC<Props<any[]>> = ({
  render,
  controls,
  renderIfError,
  container,
  fallback,
}) => {
  if (renderIfError === undefined) {
    return wrapWithContainer(container, render(useSuspenseValues(controls)));
  }

  const [values, errors] = useSuspenseValues(controls, true);

  return wrapWithContainer(
    container,
    errors.every((item) => item === undefined)
      ? render(...values)
      : renderIfError === true
        ? fallback
        : typeof renderIfError != 'function'
          ? renderIfError
          : renderIfError(errors, values)
  );
};

/**
 * A controller component for rendering multiple {@link Props.controls controls}.
 * It utilizes the {@link useSuspenseValues} hook under the hood to collect the values or errors of all provided controls.
 * This component integrates with the {@link Suspense} component, deferring rendering until all controls are resolved or an error occurs.
 *
 * @example
 * ```jsx
 *   <SuspenseAllController
 *     controls={[asyncControl1, asyncControl2]}
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
const SuspenseControlsConsumer = <
  const S extends Array<ReadonlyAsyncControl | Falsy>,
>(
  props: Props<S>
) => (
  <Suspense fallback={wrapWithContainer(props.container, props.fallback)}>
    {jsx(SuspendingControlsConsumer, props)}
  </Suspense>
);

export default SuspenseControlsConsumer;
