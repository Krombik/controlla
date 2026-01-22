import type { FC, PropsWithChildren, ReactNode, SuspenseProps } from 'react';
import type { ExtractErrors, Falsy } from '#_types';
import Suspense from '#@/Suspense';
import useAll from '#@/useAll';
import awaitOnly from '#@/awaitOnly';
import { jsx } from 'react/jsx-runtime';
import type { ReadonlyAsyncControl } from '#types';

type Props<S extends Array<ReadonlyAsyncControl | Falsy>> =
  PropsWithChildren & {
    controls: S;
    /** A function or element to render if any of the {@link Props.controls control} fail. */
    renderIfError?: ((errors: ExtractErrors<S>) => ReactNode) | ReactNode;
  } & Pick<SuspenseProps, 'fallback'>;

const Controller: FC<Props<any[]>> = ({
  controls,
  renderIfError,
  children,
  fallback,
}) => {
  controls = controls.map((control) => control && awaitOnly(control));

  if (renderIfError === undefined) {
    useAll(controls);

    return children;
  }

  const errors = useAll(controls, true)[1];

  return errors.every((item) => item === undefined)
    ? children
    : renderIfError === true
      ? fallback
      : typeof renderIfError != 'function'
        ? renderIfError
        : renderIfError(errors);
};

/**
 * A controller component for rendering multiple {@link Props.controls controls} using `awaitOnly` to avoid unnecessary re-renders.
 * It utilizes the {@link useAll} hook under the hood to monitor the resolution or failure of all provided {@link Props.controls controls}.
 * This component integrates with the {@link Suspense} component, deferring rendering until all {@link Props.controls controls} are ready or an error occurs.
 *
 * @example
 * ```jsx
 *   <SuspenseOnlyAllController
 *     controls={[asyncControl1, asyncControl2]}
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
const SuspenseOnlyAllController = <
  const S extends Array<ReadonlyAsyncControl | Falsy>,
>(
  props: Props<S>
) => <Suspense fallback={props.fallback}>{jsx(Controller, props)}</Suspense>;

export default SuspenseOnlyAllController;
