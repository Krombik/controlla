import type { FC } from 'react';
import type {
  LoadableState,
  LoadableStateScope,
  PaginatedStorage,
} from '../types';

type PaginationStateProps<T, E = any> = {
  storage: PaginatedStorage<LoadableState<T, E>>;
  /** A function to render the paginated {@link items} and their associated {@link errors}. */
  render(
    items: ReadonlyArray<T | undefined>,
    errors: ReadonlyArray<E | undefined>
  ): ReturnType<FC>;
};

type PaginationScopeProps<
  S extends LoadableStateScope,
  T extends LoadableState,
> = {
  storage: PaginatedStorage<S>;
  getState(scope: S): T;
  /** A function to render the paginated {@link items} and their associated {@link errors}. */
  render(
    items: ReadonlyArray<
      T extends LoadableState<infer V> ? V | undefined : never
    >,
    errors: ReadonlyArray<
      T extends LoadableState<any, infer E> ? E | undefined : never
    >
  ): ReturnType<FC>;
};

/**
 * A controller component for rendering paginated data using the provided {@link PaginationStateProps.storage storage} and {@link PaginationStateProps.count pages count}.
 */
const PaginationController = ((props: PaginationScopeProps<any, any>) => {
  const tuple = props.storage.usePages(props.getState);

  return props.render(tuple[0], tuple[1]);
}) as {
  <T, E = any>(props: PaginationStateProps<T, E>): ReturnType<FC>;
  <S extends LoadableStateScope, T extends LoadableState>(
    props: PaginationScopeProps<S, T>
  ): ReturnType<FC>;
};

export default PaginationController;
