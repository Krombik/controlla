import useInfiniteValues from '#core/useInfiniteValues';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import type { ReactNode } from 'react';

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

/**
 * Renders the values of a dynamic list of same-typed controls via the
 * {@link Props.render render} prop — unlike `ControlsConsumer`, the
 * {@link Props.controls controls} array may grow or shrink between renders,
 * which makes it suited for paginated/infinite data (e.g. page controls taken
 * from a registry).
 *
 * Values are positional; async controls provide `value | undefined` and start
 * loading when consumed.
 *
 * @example
 * ```jsx
 * <InfiniteControlsConsumer
 *   controls={pages.map((page) => productsRegistry.get(page))}
 *   render={(pages) => pages.map((page, i) => <Page key={i} items={page} />)}
 * />
 * ```
 */
const InfiniteControlsConsumer = <C extends ReadonlyControl>(props: Props<C>) =>
  props.render(useInfiniteValues(props.controls));

export default InfiniteControlsConsumer;
