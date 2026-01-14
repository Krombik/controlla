import { ReadonlyControl } from '#types';

const createMappedControl = <T, V>(
  control: ReadonlyControl<T>,
  mapper: (value: T) => V
): V => {};
