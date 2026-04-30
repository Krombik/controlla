import makeDerivedControl from '#internal/makeDerivedControl';
import { ControlScope, ReadonlyAsyncControl, ReadonlyControl } from '#types';

const createDerivedControl: {
  <T>(control: ReadonlyAsyncControl<T>): ControlScope<T | undefined>;
  <T>(control: ReadonlyControl<T>): ControlScope<T>;
  <T, V>(
    control: ReadonlyAsyncControl<T>,
    mapper: (value: T | undefined) => V
  ): ControlScope<V>;
  <T, V>(control: ReadonlyControl<T>, mapper: (value: T) => V): ControlScope<V>;
  <C extends ReadonlyControl[], V>(
    ...args: [
      ...controls: C,
      combiner: (
        ...values: {
          [index in keyof C]: C[index] extends ReadonlyAsyncControl<infer K>
            ? K | undefined
            : C[index] extends ReadonlyControl<infer K>
              ? K
              : never;
        }
      ) => V,
    ]
  ): ControlScope<V>;
} = (...params: any[]) => makeDerivedControl(params);

export default createDerivedControl;
