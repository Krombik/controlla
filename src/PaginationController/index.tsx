import { FC } from 'react';
import { LoadableState, PaginatedStateStorage, State } from '../types';
import useValue from '../useValue';

export type PaginationControllerProps<T, E = any> = {
  storage: PaginatedStateStorage<LoadableState<T, E>>;
  /** The number of pages to load, or a state holding the count. */
  count: number | State<number>;
  /** A function to render the paginated {@link items} and their associated {@link errors}. */
  render(
    items: ReadonlyArray<T | undefined>,
    errors: ReadonlyArray<E | undefined>
  ): ReturnType<FC>;
};

/**
 * A controller component for rendering paginated data using the provided {@link PaginationControllerProps.storage storage} and {@link PaginationControllerProps.count pages count}.
 */
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
