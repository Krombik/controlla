import makeAsyncDerivedControl from '#internal/makeAsyncDerivedControl';
import type {
  AggregateControlError,
  AsyncControlScope,
  ReadonlyAsyncControl,
  ReadonlyControl,
} from '#types';

const createAsyncDerivedControl: {
  /**
   * Creates a readonly {@link AsyncControlScope async control} that mirrors
   * the given async {@link control}, wrapping its error into an
   * {@link AggregateControlError}.
   *
   * The value recomputes only while every source is loaded and error-free.
   * Otherwise the derived control is loading, or holds an
   * {@link AggregateControlError} listing the source errors in order (the
   * last slot is the mapper's own error). Using the derived control loads its
   * loadable sources; `invalidate` reloads them.
   */
  <V, E>(
    control: ReadonlyAsyncControl<V, E>
  ): AsyncControlScope<
    Exclude<V, undefined>,
    AggregateControlError<[E, never]>
  >;
  /**
   * Creates a readonly {@link AsyncControlScope async control} from a sync
   * {@link control}: its value is treated as loaded once it isn't `undefined`.
   */
  <V>(
    control: ReadonlyControl<V>
  ): AsyncControlScope<Exclude<V, undefined>, never>;
  /**
   * Creates a readonly {@link AsyncControlScope async control} whose value is
   * the async {@link control}'s value passed through {@link mapper}.
   *
   * The {@link mapper} runs only when the source is loaded and error-free;
   * returning `undefined` keeps the derived control in the loading state, and
   * a thrown error lands in the last {@link AggregateControlError} slot.
   *
   * @example
   * ```ts
   * const $userName = createAsyncDerivedControl($user, (user) => user.name);
   * ```
   */
  <T, V, E>(
    control: ReadonlyAsyncControl<T, E>,
    mapper: (value: T) => V | undefined
  ): AsyncControlScope<V, AggregateControlError<[E, mapperError: unknown]>>;
  /**
   * Creates a readonly {@link AsyncControlScope async control} whose value is
   * the sync {@link control}'s value passed through {@link mapper} (run once
   * the value isn't `undefined`; returning `undefined` keeps the derived
   * control loading, a thrown error becomes its error).
   */
  <T, V>(
    control: ReadonlyControl<T>,
    mapper: (value: Exclude<T, undefined>) => V | undefined
  ): AsyncControlScope<
    V,
    AggregateControlError<[undefined, mapperError: unknown]>
  >;
  /**
   * Creates a readonly {@link AsyncControlScope async control} combining
   * multiple controls: the {@link combiner} runs only when every source is
   * loaded and error-free, and the {@link AggregateControlError} lists each
   * source's error positionally (last slot — the combiner's own error).
   *
   * @example
   * ```ts
   * const $total = createAsyncDerivedControl(
   *   $cart,
   *   $rates,
   *   (cart, rates) => applyRates(cart, rates)
   * );
   * ```
   */
  <C extends ReadonlyControl[], V>(
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
} = (...params: any[]) => makeAsyncDerivedControl(params);

export default createAsyncDerivedControl;
