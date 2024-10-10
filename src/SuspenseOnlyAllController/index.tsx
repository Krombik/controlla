import { FC, PropsWithChildren } from 'react';
import { AsyncState, ExtractErrors, Falsy } from '../types';
import Suspense, { SuspenseProps } from '../Suspense';
import useAll from '../useAll';
import awaitOnly from '../awaitOnly';

type Props<S extends (AsyncState<any> | Falsy)[]> = PropsWithChildren & {
  states: S;
  renderIfError?:
    | ((errors: ExtractErrors<S>) => ReturnType<FC>)
    | ReturnType<FC>;
} & Pick<SuspenseProps, 'fallback' | 'isSkeleton'>;

const AllStatesValue: FC<Props<any[]>> = ({
  states,
  renderIfError,
  children,
}) => {
  states = states.map((state) => state && awaitOnly(state));

  if (renderIfError === undefined) {
    useAll(states);

    return children;
  }

  const errors = useAll(states, true)[1];

  return errors.every((item) => item === undefined)
    ? children
    : typeof renderIfError == 'function'
      ? renderIfError(errors)
      : renderIfError;
};

const SuspenseOnlyAllController = <
  const S extends Array<AsyncState<any> | Falsy>,
>(
  props: Props<S>
) => (
  <Suspense fallback={props.fallback} isSkeleton={props.isSkeleton}>
    <AllStatesValue {...(props as any)} />
  </Suspense>
);

export default SuspenseOnlyAllController;
