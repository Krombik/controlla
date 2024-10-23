import { ComponentType, FC, PropsWithChildren, SuspenseProps } from 'react';
import { AsyncState } from '../types';
import use from '../use';
import Suspense from '../Suspense';

type Props<S extends AsyncState<any>> = {
  state: S;
  render(value: S extends AsyncState<infer V> ? V : never): ReturnType<FC>;
  renderIfError?:
    | ((
        error: S extends AsyncState<any, infer E> ? E : never
      ) => ReturnType<FC>)
    | ReturnType<FC>;
  container?: ComponentType<PropsWithChildren> | keyof JSX.IntrinsicElements;
} & Pick<SuspenseProps, 'fallback'>;

const StateValue: FC<Props<AsyncState<any>>> = ({
  render,
  state,
  renderIfError,
  container: Container,
}) => {
  let children;

  if (renderIfError === undefined) {
    children = render(use(state));
  } else {
    const [value, err] = use(state, true);

    children =
      err === undefined
        ? render(value)
        : typeof renderIfError == 'function'
          ? renderIfError(err)
          : renderIfError;
  }

  return Container && (children || children === 0) ? (
    <Container>{children}</Container>
  ) : (
    children
  );
};

const SuspenseController = <S extends AsyncState<any>>(props: Props<S>) => {
  const { container: Container, fallback } = props;

  return (
    <Suspense
      fallback={
        Container && (fallback || fallback === 0) ? (
          <Container>{fallback as any}</Container>
        ) : (
          (fallback as any)
        )
      }
    >
      <StateValue {...(props as any)} />
    </Suspense>
  );
};

export default SuspenseController;
