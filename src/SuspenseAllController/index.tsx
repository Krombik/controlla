import { ComponentType, FC, PropsWithChildren, SuspenseProps } from 'react';
import { AsyncState, ExtractErrors, ExtractValues, Falsy } from '../types';
import Suspense from '../Suspense';
import useAll from '../useAll';
import { jsx } from 'react/jsx-runtime';
import handleContainerChildren from '../utils/handleContainerChildren';

type Props<S extends Array<AsyncState | Falsy>> = {
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

const Controller: FC<Props<any[]>> = ({
  render,
  states,
  renderIfError,
  container,
}) => {
  if (renderIfError === undefined) {
    return handleContainerChildren(container, render(...useAll(states)));
  }

  const [values, errors] = useAll(states, true);

  return handleContainerChildren(
    container,
    errors.every((item) => item === undefined)
      ? render(...values)
      : typeof renderIfError == 'function'
        ? renderIfError(values, errors)
        : renderIfError
  );
};

const SuspenseAllController = <const S extends Array<AsyncState | Falsy>>(
  props: Props<S>
) => (
  <Suspense fallback={handleContainerChildren(props.container, props.fallback)}>
    {jsx(Controller, props)}
  </Suspense>
);

export default SuspenseAllController;
