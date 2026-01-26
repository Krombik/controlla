import type { FC, JSX, ReactNode, SuspenseProps } from 'react';
import type { ContainerComponent, RenderablePrimitives } from '#internal/types';
import useSuspenseValue from '#@/useSuspenseValue';
import Suspense from '#@/Suspense';
import { jsx } from 'react/jsx-runtime';
import wrapWithContainer from '#internal/wrapWithContainer';
import type { ReadonlyAsyncControl } from '#types';

type Props<E> = {
  renderIfError?: ((error: E) => ReactNode) | ReactNode;
  /** If provided, it wraps the rendered content or fallback only if they exist. */
  container?: ContainerComponent;
} & Pick<SuspenseProps, 'fallback'>;

interface RenderProps<S extends ReadonlyAsyncControl> extends Props<
  S extends ReadonlyAsyncControl<any, infer E> ? E : never
> {
  control: S;
  /** A function to render the content when the {@link RenderProps.control control} resolves successfully. */
  render(value: S extends ReadonlyAsyncControl<infer V> ? V : never): ReactNode;
}

interface TruthyGateProps<E> extends Props<E> {
  control: ReadonlyAsyncControl<boolean | RenderablePrimitives, E>;
  children: ReactNode;
  render?: never;
}

interface PrimitiveDisplayProps<E> extends Props<E> {
  control: ReadonlyAsyncControl<
    RenderablePrimitives | Array<RenderablePrimitives>,
    E
  >;
  render?: never;
  children?: never;
}

const SuspendingControlConsumer: FC<
  | RenderProps<ReadonlyAsyncControl>
  | TruthyGateProps<any>
  | PrimitiveDisplayProps<any>
> = (props) => {
  const { renderIfError } = props;

  const isSafe = renderIfError !== undefined;

  const t = useSuspenseValue(props.control, isSafe);

  const value = isSafe ? t[0] : t;

  return wrapWithContainer(
    props.container,
    !isSafe || t[1] === undefined
      ? 'render' in props
        ? props.render!(value)
        : 'children' in props
          ? value
            ? props.children
            : null
          : value
      : renderIfError === true
        ? props.fallback
        : typeof renderIfError != 'function'
          ? renderIfError
          : renderIfError(t[1])
  );
};

/**
 * A controller component for rendering a {@link RenderProps.control control}.
 * It utilizes the {@link useSuspenseValue} hook under the hood to retrieve the value or error of the provided control.
 * This component integrates with the {@link Suspense} component, deferring rendering until the control is resolved or an error occurs.
 *
 * @example
 * ```jsx
 *   <SuspenseController
 *     control={asyncControl}
 *     container="div"
 *     fallback={<div>Loading...</div>}
 *     render={(data) => <div>Data: {JSON.stringify(data)}</div>}
 *     renderIfError={(error) => <div>Error: {error.message}</div>}
 *   />
 * ```
 */
const SuspenseControlConsumer: {
  <S extends ReadonlyAsyncControl>(props: RenderProps<S>): JSX.Element;
  <E>(props: TruthyGateProps<E>): JSX.Element;
  <E>(props: PrimitiveDisplayProps<E>): JSX.Element;
} = (
  props: RenderProps<any> | TruthyGateProps<any> | PrimitiveDisplayProps<any>
) => (
  <Suspense fallback={wrapWithContainer(props.container, props.fallback)}>
    {jsx(SuspendingControlConsumer, props)}
  </Suspense>
);

export default SuspenseControlConsumer;
