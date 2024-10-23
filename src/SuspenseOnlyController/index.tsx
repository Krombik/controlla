import { FC, PropsWithChildren, SuspenseProps } from 'react';
import { AsyncState } from '../types';
import use from '../use';
import Suspense from '../Suspense';
import awaitOnly from '../awaitOnly';

type Props<S extends AsyncState<any>> = PropsWithChildren & {
  state: S;
  renderIfError?:
    | ((
        error: S extends AsyncState<any, infer E> ? E : never
      ) => ReturnType<FC>)
    | ReturnType<FC>;
} & Pick<SuspenseProps, 'fallback'>;

const StateValue: FC<Props<AsyncState<any>>> = ({
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

const SuspenseOnlyController = <S extends AsyncState<any>>(props: Props<S>) => (
  <Suspense fallback={props.fallback}>
    <StateValue {...props} />
  </Suspense>
);

export default SuspenseOnlyController;
