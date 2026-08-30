import { useContext, type ReactNode } from 'react';

import type { Control } from '#types';
import type { FieldProps } from '#form/types';
import useFieldProps from '#form/internal/useFieldProps';
import { getFieldState } from '#form/internal/entry';
import useEntry from '#form/internal/useEntry';
import FormContext from '#form/internal/FormContext';
import throwNoProvider from '#form/internal/throwNoProvider';

const Field = ((props: FieldProps) => {
  const { control } = props;

  const form = useContext(FormContext) || throwNoProvider();

  const entry = useEntry(form, control);

  return props.render(
    useFieldProps(control, form, entry, props.onChange, !!props.replace),
    getFieldState(entry)
  );
}) as {
  /**
   * `useField` as a component, for a component that owns its own rendering - a
   * date picker, a combobox, anything taking a `value` and an `onChange`.
   * Reading the value rerenders on every keystroke, and being a component is
   * what keeps that rerender to this field instead of the section around it.
   *
   * The wiring goes on your component; the {@link FieldState state} is there for
   * `$isDirty` and the rest, and costs nothing where you leave it unread. An
   * `input`, `select` or `textarea` belongs to `NativeField`, which rerenders
   * nothing at all.
   *
   * Validation is `Validator`/`PathValidator`; this only reports whether some
   * validator holds an error for the field. {@link FieldProps.onChange onChange}
   * is called with each value written, in the same commit as it.
   *
   * @example
   * ```tsx
   * <Field
   *   control={$values.country}
   *   render={({ value, onChange, isError, ...rest }) => (
   *     <Select {...rest} value={value} onChange={onChange} error={isError} />
   *   )}
   * />
   * ```
   */
  <C extends Control>(props: FieldProps<C>): ReactNode;
};

export default Field;
