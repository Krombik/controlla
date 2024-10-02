import { FC, SuspenseProps } from 'react';
import { AsyncState, ExtractError, ExtractValues, Falsy } from '../types';
import Suspense from '../Suspense';
import useAll from '../useAll';

export type SuspenseAllStatesValueProps<S extends (AsyncState<any> | Falsy)[]> =
  {
    states: S;
    render(...values: ExtractValues<S>): ReturnType<FC>;
    renderIfError?:
      | ((error: ExtractError<S>) => ReturnType<FC>)
      | ReturnType<FC>;
  } & Pick<SuspenseProps, 'fallback'>;

const AllStatesValue: FC<SuspenseAllStatesValueProps<any[]>> = ({
  render,
  states,
  renderIfError,
}) => {
  if (renderIfError === undefined) {
    return render(...useAll(states));
  }

  const [values, err] = useAll(states, true);

  return err === undefined
    ? render(...values)
    : typeof renderIfError == 'function'
      ? renderIfError(err)
      : renderIfError;
};

const SuspenseAllStatesValue = <const S extends Array<AsyncState<any> | Falsy>>(
  props: SuspenseAllStatesValueProps<S>
) => (
  <Suspense fallback={props.fallback}>
    <AllStatesValue {...props} />
  </Suspense>
);

export default SuspenseAllStatesValue;
