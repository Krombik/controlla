import makeAsyncDerivedControl from '#internal/makeAsyncDerivedControl';
import type {
  AggregateControlError,
  AsyncControlScope,
  ReadonlyAsyncControl,
  ReadonlyControl,
} from '#types';

const createSnapshotControl: {
  /**
   * Creates a {@link AsyncControlScope async control} that takes the given
   * async {@link control}'s value once - the first one it is ready with,
   * wrapping its error into an {@link AggregateControlError}.
   *
   * Until then it is loading, or holds the source error. After that the source
   * is let go: reloading or changing it leaves this control as it was, and its
   * value is free to be set.
   */
  <V, E>(
    control: ReadonlyAsyncControl<V, E>
  ): AsyncControlScope<
    Exclude<V, undefined>,
    AggregateControlError<[E, never]>
  >;
  /**
   * Creates a {@link AsyncControlScope async control} that takes the sync
   * {@link control}'s value once - the first one that isn't `undefined`.
   */
  <V>(
    control: ReadonlyControl<V>
  ): AsyncControlScope<Exclude<V, undefined>, never>;
  /**
   * Creates a {@link AsyncControlScope async control} whose value is the async
   * {@link control}'s first ready value passed through {@link mapper}.
   *
   * The {@link mapper} runs once, and only when the source is ready and
   * error-free; returning `undefined` keeps waiting for the next value, and a
   * thrown error lands in the last {@link AggregateControlError} slot.
   *
   * @example
   * ```ts
   * const $draft = createSnapshotControl($user, (user) => ({ ...user }));
   * ```
   */
  <T, V, E>(
    control: ReadonlyAsyncControl<T, E>,
    mapper: (value: T) => V | undefined
  ): AsyncControlScope<V, AggregateControlError<[E, mapperError: unknown]>>;
  /**
   * Creates a {@link AsyncControlScope async control} whose value is the sync
   * {@link control}'s first defined value passed through {@link mapper}.
   */
  <T, V>(
    control: ReadonlyControl<T>,
    mapper: (value: Exclude<T, undefined>) => V | undefined
  ): AsyncControlScope<
    V,
    AggregateControlError<[undefined, mapperError: unknown]>
  >;
  /**
   * Creates a {@link AsyncControlScope async control} from multiple controls:
   * the {@link combiner} runs once, at the first moment every source is ready
   * and error-free. The {@link AggregateControlError} lists each source's error
   * positionally (last slot - the combiner's own error).
   *
   * @example
   * ```ts
   * const $order = createSnapshotControl(
   *   $cart,
   *   $rates,
   *   (cart, rates) => ({ items: cart.items, usd: cart.total * rates.usd })
   * );
   * ```
   */
  <const C extends ReadonlyControl[], V>(
    ...args: [
      ...controls: C,
      combiner: (
        ...values: {
          [index in keyof C]: C[index] extends ReadonlyAsyncControl<infer K>
            ? K
            : C[index] extends ReadonlyControl<infer K>
              ? Exclude<K, undefined>
              : never;
        }
      ) => V | undefined,
    ]
  ): AsyncControlScope<
    V,
    AggregateControlError<
      [
        ...{
          [index in keyof C]: C[index] extends ReadonlyAsyncControl<
            any,
            infer K
          >
            ? K
            : undefined;
        },
        mapperError: unknown,
      ]
    >
  >;
} = (...params: any[]) => makeAsyncDerivedControl(params, true);

export default createSnapshotControl;
