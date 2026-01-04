import type { ReactNode } from 'react';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import useMappedValue from '#@/useMappedValue';

type Props<S extends ReadonlyControl, V> = {
  control: S;
  /** Function that maps the {@link Props.control control’s} value. */
  mapper(
    ...args: S extends ReadonlyAsyncControl<infer T, infer E>
      ? [value: T | undefined, isLoaded: boolean, error: E | undefined]
      : S extends ReadonlyControl<infer T>
        ? [value: T]
        : never
  ): V;
  /** Function to render the mapped value. */
  render(mappedValue: V): ReactNode;
};

const MappedController: {
  /**
   * A controller that {@link mapper maps} a value from {@link Props.control control} and passes it to a {@link Props.render render} function.
   * This component serves as a wrapper for the {@link useMappedValue} hook.
   * @example
   * ```jsx
   * <MappedController
   *   control={control}
   *   mapper={(value) => value % 2}
   *   render={(isEven) => <span>{isEven ? 'even' : 'odd'}</span>}
   * />
   *
   * <MappedController
   *   control={asyncControl}
   *   mapper={(value, isLoaded) => !isLoaded || !!value }
   *   render={(isRenderable) => isRenderable && <Component />}
   * />
   * ```
   */
  <S extends ReadonlyControl, V>(props: Props<S, V>): ReactNode;
} = (props: Props<any, any>) =>
  props.render(useMappedValue(props.control, props.mapper));

export default MappedController;
