import { useContext, type ReactNode } from 'react';

import type { Control } from '#types';
import type {
  ExactControl,
  NativeFieldConverters,
  NativeFieldProps,
  NativeFieldType,
} from '#form/types';
import useNativeProps from '#form/internal/useNativeProps';
import { getEntry, getFieldState } from '#form/internal/entry';
import FormContext from '#form/internal/FormContext';
import throwNoProvider from '#form/internal/throwNoProvider';

const NativeField = ((props: NativeFieldProps) => {
  const form = useContext(FormContext) || throwNoProvider();

  const entry = getEntry(form, props.control);

  return props.render(useNativeProps(form, entry, props), getFieldState(entry));
}) as {
  /**
   * `useNativeField` as a component: a field the element owns, mountable
   * conditionally without a component of its own. Typing rerenders nothing -
   * neither this nor what's around it - and the {@link FieldState state} the
   * {@link NativeFieldProps.render render} gets costs a rerender only where you
   * read it.
   *
   * Everything but the {@link NativeFieldProps.control control} is read once.
   *
   * @example
   * ```tsx
   * <NativeField
   *   type='decimal'
   *   control={$values.amount}
   *   errorId='amount-error'
   *   render={(props, { $isError }) => (
   *     <input {...props} aria-hidden={useValue($isError)} />
   *   )}
   * />
   * ```
   */
  <T extends NativeFieldType, C extends Control>(
    props: NativeFieldProps<T, C> &
      ExactControl<T, C> & { parse?: never; format?: never }
  ): ReactNode;
  /**
   * The same, with the value converted on its way to the control and back —
   * see {@link NativeFieldConverters}.
   */
  <T extends NativeFieldType, C extends Control>(
    props: NativeFieldProps<T, C> & NativeFieldConverters<T, C>
  ): ReactNode;
};

export default NativeField;
