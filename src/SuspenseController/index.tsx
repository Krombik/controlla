import { ComponentType, FC, PropsWithChildren, SuspenseProps } from 'react';
import { AsyncState } from '../types';
import use from '../use';
import Suspense from '../Suspense';
import { jsx } from 'react/jsx-runtime';
import handleContainerChildren from '../utils/handleContainerChildren';

type Props<S extends AsyncState> = {
  state: S;
  render(value: S extends AsyncState<infer V> ? V : never): ReturnType<FC>;
  renderIfError?:
    | ((
        error: S extends AsyncState<any, infer E> ? E : never
      ) => ReturnType<FC>)
    | ReturnType<FC>;
  container?: ComponentType<PropsWithChildren> | keyof JSX.IntrinsicElements;
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

const SuspenseController = <S extends AsyncState>(props: Props<S>) => (
  <Suspense fallback={handleContainerChildren(props.container, props.fallback)}>
    {jsx(Controller, props)}
  </Suspense>
);

export default SuspenseController;
