import type { FC, PropsWithChildren, ReactNode, SuspenseProps } from 'react';
import type { ReadonlyAsyncControl } from '#types';
import use from '#@/use';
import Suspense from '#@/Suspense';
import awaitOnly from '#@/awaitOnly';
import { jsx } from 'react/jsx-runtime';

type Props<S extends ReadonlyAsyncControl> = PropsWithChildren & {
  control: S;
  /** A function or element to render if the {@link Props.control control} fails. */
  renderIfError?:
    | ((
        error: S extends ReadonlyAsyncControl<any, infer E> ? E : never
      ) => ReactNode)
    | ReactNode;
} & Pick<SuspenseProps, 'fallback'>;

const Controller: FC<Props<ReadonlyAsyncControl>> = ({
  control,
  renderIfError,
  children,
}) => {
  if (renderIfError === undefined) {
    use(awaitOnly(control));

    return children;
  }

  const err = use(awaitOnly(control), true)[1];

  return err === undefined
    ? children
    : typeof renderIfError == 'function'
      ? renderIfError(err)
      : renderIfError;
};

/**
 * A controller component for rendering a {@link Props.control control} using `awaitOnly` to avoid unnecessary re-renders.
 * It utilizes the {@link use} hook to monitor the {@link Props.control control’s} resolution or failure.
 * This component integrates with the {@link Suspense} component, deferring rendering until the {@link Props.control control} is resolved or an error occurs.
 *
 * @example
 * ```jsx
 *   <SuspenseOnlyController
 *     control={asyncControl}
 *     fallback={<div>Loading...</div>}
 *     renderIfError={(error) => <div>Error: {error.message}</div>}
 *   >
 *     <div>Data loaded successfully!</div>
 *   </SuspenseOnlyController>
 * ```
 */
const SuspenseOnlyController = <S extends ReadonlyAsyncControl>(
  props: Props<S>
) => <Suspense fallback={props.fallback}>{jsx(Controller, props)}</Suspense>;

export default SuspenseOnlyController;
