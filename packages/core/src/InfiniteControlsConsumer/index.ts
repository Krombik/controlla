import useInfiniteValues from '#@/useInfiniteValues';
import { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { ReactNode } from 'react';

type Props<C extends ReadonlyControl> = {
  controls: C[];
  render(
    values: Array<
      C extends ReadonlyAsyncControl<infer K>
        ? K | undefined
        : C extends ReadonlyControl<infer K>
          ? K
          : never
    >
  ): ReactNode;
};

const InfiniteControlsConsumer = <C extends ReadonlyControl>(props: Props<C>) =>
  props.render(useInfiniteValues(props.controls));

export default InfiniteControlsConsumer;
