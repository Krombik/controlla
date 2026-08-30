import type { Control, SelectValue } from '#types';
import type { FieldRenderProps } from '#form/types';
import useFieldProps from '#form/internal/useFieldProps';
import { useContext } from 'react';
import FormContext from '#form/internal/FormContext';
import throwNoProvider from '#form/internal/throwNoProvider';
import useEntry from '#form/internal/useEntry';

/**
 * Registers the {@link control} as a field of the form around it and hands back
 * the wiring for a component that owns its own rendering - a `value`, an
 * `onChange` taking the value itself, and whether a validator holds an error
 * for it.
 *
 * Throws outside a `FormProvider`.
 *
 * {@link onChange} is called with each value the field writes, in the same
 * commit as it - a set made there lands in the same render. {@link replace} is
 * for a router params control: it replaces the current history entry instead
 * of pushing one.
 *
 * Reading the value here means this component rerenders on every keystroke,
 * which a component taking a `value` prop makes unavoidable. For an `input`,
 * `select` or `textarea`, `useNativeField` lets the element own the value and
 * rerenders nothing; for the rest, `Field` is this hook as a component, so the
 * rerender stops there.
 *
 * @example
 * ```tsx
 * const { value, onChange, isError, ...rest } = useField($values.country);
 *
 * return <Select {...rest} value={value} onChange={onChange} error={isError} />;
 * ```
 */
const useField = <C extends Control>(
  control: C,
  onChange?: (value: SelectValue<C>) => void,
  replace?: boolean
): FieldRenderProps<SelectValue<C>> => {
  const form = useContext(FormContext) || throwNoProvider();

  return useFieldProps(
    control,
    form,
    useEntry(form, control),
    onChange,
    !!replace
  );
};

export default useField;
