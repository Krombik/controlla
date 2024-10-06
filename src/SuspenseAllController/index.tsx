import { FC } from 'react';
import { AsyncState, ExtractErrors, ExtractValues, Falsy } from '../types';
import Suspense, { SuspenseProps } from '../Suspense';
import useAll from '../useAll';

export type SuspenseAllControllerProps<S extends (AsyncState<any> | Falsy)[]> =
  {
    states: S;
    render(...values: ExtractValues<S>): ReturnType<FC>;
    renderIfError?:
      | ((
          values: ExtractValues<S, true>,
          errors: ExtractErrors<S>
        ) => ReturnType<FC>)
      | ReturnType<FC>;
  } & Pick<SuspenseProps, 'fallback' | 'isSkeleton'>;

const AllStatesValue: FC<SuspenseAllControllerProps<any[]>> = ({
  render,
  states,
  renderIfError,
}) => {
  if (renderIfError === undefined) {
    return render(...useAll(states));
  }

  const [values, errors] = useAll(states, true);

  return errors.every((item) => item === undefined)
    ? render(...values)
    : typeof renderIfError == 'function'
      ? renderIfError(values, errors)
      : renderIfError;
};

const SuspenseAllController = <const S extends Array<AsyncState<any> | Falsy>>(
  props: SuspenseAllControllerProps<S>
) => (
  <Suspense fallback={props.fallback} isSkeleton={props.isSkeleton}>
    <AllStatesValue {...(props as any)} />
  </Suspense>
);

export default SuspenseAllController;
