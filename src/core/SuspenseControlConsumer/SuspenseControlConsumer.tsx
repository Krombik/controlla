import type { FC, JSX, ReactNode, SuspenseProps } from 'react';
import type { ContainerComponent, RenderablePrimitives } from '#internal/types';
import useSuspenseValue from '#core/useSuspenseValue';
import Suspense from '#core/Suspense';
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

const SuspenseControlConsumer: {
  /**
   * Renders the async {@link RenderProps.control control}'s value via the
   * {@link RenderProps.render render} prop, showing the
   * {@link Props.fallback fallback} while it loads. Includes its own
   * {@link Suspense} boundary — no outer one is needed. Using it starts the
   * control's loading.
   *
   * An error throws to the nearest error boundary. To render it instead,
   * pass {@link Props.renderIfError renderIfError}: a render function
   * receiving the error, a ReactNode, or `true` to show the fallback. The
   * optional {@link Props.container container} wraps the content or fallback
   * only when there is something to show.
   *
   * @example
   * ```jsx
   * <SuspenseControlConsumer
   *   control={$user}
   *   container="div"
   *   fallback={<Spinner />}
   *   render={(user) => <UserCard user={user} />}
   *   renderIfError={(error) => <ErrorMessage error={error} />}
   * />
   * ```
   */
  <S extends ReadonlyAsyncControl>(props: RenderProps<S>): JSX.Element;
  /**
   * Renders {@link TruthyGateProps.children children} once the async
   * {@link TruthyGateProps.control control} is loaded and its value is truthy,
   * showing the {@link Props.fallback fallback} while it loads.
   */
  <E>(props: TruthyGateProps<E>): JSX.Element;
  /**
   * Renders the async {@link PrimitiveDisplayProps.control control}'s value
   * directly as a React node once it loads, showing the
   * {@link Props.fallback fallback} until then.
   */
  <E>(props: PrimitiveDisplayProps<E>): JSX.Element;
} = (
  props: RenderProps<any> | TruthyGateProps<any> | PrimitiveDisplayProps<any>
) => (
  <Suspense fallback={wrapWithContainer(props.container, props.fallback)}>
    {jsx(SuspendingControlConsumer, props)}
  </Suspense>
);

export default SuspenseControlConsumer;
