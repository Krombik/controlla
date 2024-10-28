import type { FC, PropsWithChildren, SuspenseProps } from 'react';
import type { AsyncState } from '../types';
import use from '../use';
import Suspense from '../Suspense';
import awaitOnly from '../awaitOnly';
import { jsx } from 'react/jsx-runtime';

type Props<S extends AsyncState> = PropsWithChildren & {
  state: S;
  /** A function or element to render if the {@link Props.state state} fails. */
  renderIfError?:
    | ((
        error: S extends AsyncState<any, infer E> ? E : never
      ) => ReturnType<FC>)
    | ReturnType<FC>;
} & Pick<SuspenseProps, 'fallback'>;

const Controller: FC<Props<AsyncState>> = ({
  state,
  renderIfError,
  children,
}) => {
  if (renderIfError === undefined) {
    use(awaitOnly(state));

    return children;
  }

  const err = use(awaitOnly(state), true)[1];

  return err === undefined
    ? children
    : typeof renderIfError == 'function'
      ? renderIfError(err)
      : renderIfError;
};

/**
 * A controller component for rendering a {@link Props.state state} using `awaitOnly` to avoid unnecessary re-renders.
 * It utilizes the {@link use} hook to monitor the {@link Props.state state’s} resolution or failure.
 * This component integrates with the {@link Suspense} component, deferring rendering until the {@link Props.state state} is resolved or an error occurs.
 *
 * @example
 * ```jsx
 *   <SuspenseOnlyController
 *     state={asyncState}
 *     fallback={<div>Loading...</div>}
 *     renderIfError={(error) => <div>Error: {error.message}</div>}
 *   >
 *     <div>Data loaded successfully!</div>
 *   </SuspenseOnlyController>
 * ```
 */
const SuspenseOnlyController = <S extends AsyncState>(props: Props<S>) => (
  <Suspense fallback={props.fallback}>{jsx(Controller, props)}</Suspense>
);

export default SuspenseOnlyController;
