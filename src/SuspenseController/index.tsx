import { FC } from 'react';
import { AsyncState, ResolvedValue } from '../types';
import use from '../use';
import Suspense, { SuspenseProps } from '../Suspense';

export type SuspenseControllerProps<V, E = any> = {
  state: AsyncState<V, E>;
  render(value: ResolvedValue<V>): ReturnType<FC>;
  renderIfError?: ((error: E) => ReturnType<FC>) | ReturnType<FC>;
} & Pick<SuspenseProps, 'fallback' | 'isSkeleton'>;

const StateValue: FC<SuspenseControllerProps<unknown, unknown>> = ({
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

const SuspenseController = <V, E = any>(
  props: SuspenseControllerProps<V, E>
) => (
  <Suspense fallback={props.fallback} isSkeleton={props.isSkeleton}>
    <StateValue {...props} />
  </Suspense>
);

export default SuspenseController;
