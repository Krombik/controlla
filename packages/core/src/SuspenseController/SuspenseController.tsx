import type { FC, ReactNode, SuspenseProps } from 'react';
import type { ContainerType } from '#_types';
import use from '#@/use';
import Suspense from '#@/Suspense';
import { jsx } from 'react/jsx-runtime';
import handleContainerChildren from '#utils/handleContainerChildren';
import type { ReadonlyAsyncControl } from '#types';

type Props<S extends ReadonlyAsyncControl> = {
  control: S;
  /** A function to render the content when the {@link Props.control control} resolves successfully. */
  render(value: S extends ReadonlyAsyncControl<infer V> ? V : never): ReactNode;
  /** A function or element to render if the {@link Props.control control} fails. */
  renderIfError?:
    | ((
        error: S extends ReadonlyAsyncControl<any, infer E> ? E : never
      ) => ReactNode)
    | ReactNode;
  /** If provided, it wraps the rendered content or fallback only if they exist. */
  container?: ContainerType;
} & Pick<SuspenseProps, 'fallback'>;

const Controller: FC<Props<ReadonlyAsyncControl>> = ({
  render,
  control,
  renderIfError,
  container,
}) => {
  if (renderIfError === undefined) {
    return handleContainerChildren(container, render(use(control)));
  }

  const [value, err] = use(control, true);

  return handleContainerChildren(
    container,
    err === undefined
      ? render(value)
      : typeof renderIfError == 'function'
        ? renderIfError(err)
        : renderIfError
  );
};

/**
 * A controller component for rendering a {@link Props.control control}.
 * It utilizes the {@link use} hook under the hood to retrieve the value or error of the provided control.
 * This component integrates with the {@link Suspense} component, deferring rendering until the control is resolved or an error occurs.
 *
 * @example
 * ```jsx
 *   <SuspenseController
 *     control={asyncControl}
 *     container="div"
 *     fallback={<div>Loading...</div>}
 *     render={(data) => <div>Data: {JSON.stringify(data)}</div>}
 *     renderIfError={(error) => <div>Error: {error.message}</div>}
 *   />
 * ```
 */
const SuspenseController = <S extends ReadonlyAsyncControl>(
  props: Props<S>
) => (
  <Suspense fallback={handleContainerChildren(props.container, props.fallback)}>
    {jsx(Controller, props)}
  </Suspense>
);

export default SuspenseController;
