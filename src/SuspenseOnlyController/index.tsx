import { FC, PropsWithChildren, SuspenseProps } from 'react';
import { AsyncState } from '../types';
import use from '../use';
import Suspense from '../Suspense';
import awaitOnly from '../awaitOnly';
import { jsx } from 'react/jsx-runtime';

type Props<S extends AsyncState> = PropsWithChildren & {
  state: S;
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

const SuspenseOnlyController = <S extends AsyncState>(props: Props<S>) => (
  <Suspense fallback={props.fallback}>{jsx(Controller, props)}</Suspense>
);

export default SuspenseOnlyController;
