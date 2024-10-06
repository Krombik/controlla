import { FC } from 'react';
import { LoadableState, PaginatedStateStorage, State } from '../types';
import useValue from '../useValue';

export type PaginationControllerProps<T, E = any> = {
  storage: PaginatedStateStorage<LoadableState<T, E>>;
  count: number | State<number>;
  render(
    items: ReadonlyArray<T | undefined>,
    errors: ReadonlyArray<E | undefined>
  ): ReturnType<FC>;
};

const PaginationController = <T, E = any>({
  storage,
  count,
  render,
}: PaginationControllerProps<T, E>) => {
  const t = storage.usePages(
    typeof count == 'number' ? count : useValue(count)
  );

  return render(t[0], t[1]);
};

export default PaginationController;
