import { FC, SuspenseProps } from 'react';
import { AsyncState, ResolvedValue } from '../types';
import use from '../use';
import Suspense from '../Suspense';

export type SuspenseStateValueProps<V, E = any> = {
  state: AsyncState<V, E>;
  render(value: ResolvedValue<V>): ReturnType<FC>;
  renderIfError?: ((error: E) => ReturnType<FC>) | ReturnType<FC>;
} & Pick<SuspenseProps, 'fallback'>;

const StateValue: FC<SuspenseStateValueProps<unknown, unknown>> = ({
  render,
  state,
  renderIfError,
}) => {
  if (renderIfError === undefined) {
    return render(use(state));
  }

  const [value, err] = use(state, true);

  return err === undefined
    ? render(value)
    : typeof renderIfError == 'function'
      ? renderIfError(err)
      : renderIfError;
};

const SuspenseStateValue = <V, E = any>(
  props: SuspenseStateValueProps<V, E>
) => (
  <Suspense fallback={props.fallback}>
    <StateValue {...props} />
  </Suspense>
);

export default SuspenseStateValue;
