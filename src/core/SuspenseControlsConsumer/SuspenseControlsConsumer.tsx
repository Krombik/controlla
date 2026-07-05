import type { FC, ReactNode, SuspenseProps } from 'react';
import type {
  ContainerComponent,
  ExtractErrors,
  ExtractValues,
  Falsy,
} from '#internal/types';
import Suspense from '#core/Suspense';
import useSuspenseValues from '#core/useSuspenseValues';
import { jsx } from 'react/jsx-runtime';
import wrapWithContainer from '#internal/wrapWithContainer';
import type { ReadonlyAsyncControl } from '#types';

type Props<S extends Array<ReadonlyAsyncControl | Falsy>> = {
  controls: S;
  /** A function to render the final content when all {@link Props.controls controls} resolve successfully. */
  render(...values: ExtractValues<S>): ReactNode;
  /** A function or element to render if any of the {@link Props.controls controls} fail */
  renderIfError?:
    | ((errors: ExtractErrors<S>, values: ExtractValues<S, true>) => ReactNode)
    | ReactNode;
  /** If provided, it wraps the rendered content or fallback only if they exist. */
  container?: ContainerComponent;
} & Pick<SuspenseProps, 'fallback'>;

const SuspendingControlsConsumer: FC<Props<any[]>> = ({
  render,
  controls,
  renderIfError,
  container,
  fallback,
}) => {
  if (renderIfError === undefined) {
    return wrapWithContainer(container, render(...useSuspenseValues(controls)));
  }

  const [values, errors] = useSuspenseValues(controls, true);

  return wrapWithContainer(
    container,
    errors.every((item) => item === undefined)
      ? render(...values)
      : renderIfError === true
        ? fallback
        : typeof renderIfError != 'function'
          ? renderIfError
          : renderIfError(errors, values)
  );
};

/**
 * Renders the values of multiple async {@link Props.controls controls} via
 * the {@link Props.render render} prop, showing the
 * {@link Props.fallback fallback} until all of them are ready. Includes its
 * own {@link Suspense} boundary — no outer one is needed. Using it starts the
 * controls' loading; an entry may be falsy (its value is `undefined`).
 *
 * An error throws to the nearest error boundary. To render it instead, pass
 * {@link Props.renderIfError renderIfError}: a render function receiving the
 * positional errors and values, a ReactNode, or `true` to show the fallback.
 * The optional {@link Props.container container} wraps the content or
 * fallback only when there is something to show.
 *
 * @example
 * ```jsx
 * <SuspenseControlsConsumer
 *   controls={[$user, $cart]}
 *   fallback={<p>Loading...</p>}
 *   render={(user, cart) => <p>{user.name} — {cart.length} items</p>}
 *   renderIfError={(errors) => <p>{String(errors.find(Boolean))}</p>}
 * />
 * ```
 */
const SuspenseControlsConsumer = <
  const S extends Array<ReadonlyAsyncControl | Falsy>,
>(
  props: Props<S>
) => (
  <Suspense fallback={wrapWithContainer(props.container, props.fallback)}>
    {jsx(SuspendingControlsConsumer, props)}
  </Suspense>
);

export default SuspenseControlsConsumer;
