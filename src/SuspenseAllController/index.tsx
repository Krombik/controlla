import { ComponentType, FC, PropsWithChildren, SuspenseProps } from 'react';
import { AsyncState, ExtractErrors, ExtractValues, Falsy } from '../types';
import Suspense from '../Suspense';
import useAll from '../useAll';

type Props<S extends (AsyncState<any> | Falsy)[]> = {
  states: S;
  render(...values: ExtractValues<S>): ReturnType<FC>;
  renderIfError?:
    | ((
        values: ExtractValues<S, true>,
        errors: ExtractErrors<S>
      ) => ReturnType<FC>)
    | ReturnType<FC>;
  container?: ComponentType<PropsWithChildren> | keyof JSX.IntrinsicElements;
} & Pick<SuspenseProps, 'fallback'>;

const AllStatesValue: FC<Props<any[]>> = ({
  render,
  states,
  renderIfError,
  container: Container,
}) => {
  let children;

  if (renderIfError === undefined) {
    children = render(...useAll(states));
  } else {
    const [values, errors] = useAll(states, true);

    children = errors.every((item) => item === undefined)
      ? render(...values)
      : typeof renderIfError == 'function'
        ? renderIfError(values, errors)
        : renderIfError;
  }

  return Container && (children || children === 0) ? (
    <Container>{children}</Container>
  ) : (
    children
  );
};

const SuspenseAllController = <const S extends Array<AsyncState<any> | Falsy>>(
  props: Props<S>
) => {
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
      <AllStatesValue {...(props as any)} />
    </Suspense>
  );
};

export default SuspenseAllController;
