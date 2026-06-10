import makeAsyncDerivedControl from '#internal/makeAsyncDerivedControl';
import type {
  AggregateControlError,
  AsyncControlScope,
  ReadonlyAsyncControl,
  ReadonlyControl,
} from '#types';

const createAsyncDerivedControl: {
  <V, E>(
    control: ReadonlyAsyncControl<V, E>
  ): AsyncControlScope<
    Exclude<V, undefined>,
    AggregateControlError<[E, never]>
  >;
  <V>(
    control: ReadonlyControl<V>
  ): AsyncControlScope<Exclude<V, undefined>, never>;
  <T, V, E>(
    control: ReadonlyAsyncControl<T, E>,
    mapper: (value: T) => V | undefined
  ): AsyncControlScope<V, AggregateControlError<[E, mapperError: unknown]>>;
  <T, V>(
    control: ReadonlyControl<T>,
    mapper: (value: Exclude<T, undefined>) => V | undefined
  ): AsyncControlScope<
    V,
    AggregateControlError<[undefined, mapperError: unknown]>
  >;
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
