import { FC, SuspenseProps } from 'react';
import { AsyncState, ContainerType } from '../types';
import use from '../use';
import Suspense from '../Suspense';
import { jsx } from 'react/jsx-runtime';
import handleContainerChildren from '../utils/handleContainerChildren';

type Props<S extends AsyncState> = {
  state: S;
  /** A function to render the content when the {@link Props.state state} resolves successfully. */
  render(value: S extends AsyncState<infer V> ? V : never): ReturnType<FC>;
  /** A function or element to render if the {@link Props.state state} fails. */
  renderIfError?:
    | ((
        error: S extends AsyncState<any, infer E> ? E : never
      ) => ReturnType<FC>)
    | ReturnType<FC>;
  /** If provided, it wraps the rendered content or fallback only if they exist. */
  container?: ContainerType;
} & Pick<SuspenseProps, 'fallback'>;

const Controller: FC<Props<AsyncState>> = ({
  render,
  state,
  renderIfError,
  container,
}) => {
  if (renderIfError === undefined) {
    return handleContainerChildren(container, render(use(state)));
  }

  const [value, err] = use(state, true);

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
 * A controller component for rendering a {@link Props.state state}.
 * It utilizes the {@link use} hook under the hood to retrieve the value or error of the provided state.
 * This component integrates with the {@link Suspense} component, deferring rendering until the state is resolved or an error occurs.
 *
 * @example
 * ```jsx
 *   <SuspenseController
 *     state={asyncState}
 *     container="div"
 *     fallback={<div>Loading...</div>}
 *     render={(data) => <div>Data: {JSON.stringify(data)}</div>}
 *     renderIfError={(error) => <div>Error: {error.message}</div>}
 *   />
 * ```
 */
const SuspenseController = <S extends AsyncState>(props: Props<S>) => (
  <Suspense fallback={handleContainerChildren(props.container, props.fallback)}>
    {jsx(Controller, props)}
  </Suspense>
);

export default SuspenseController;
