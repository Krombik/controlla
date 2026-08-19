import type { Control, SelectValue } from '#types';
import type { FieldRenderProps } from '#form/types';
import useFieldProps from '#form/internal/useFieldProps';
import { useContext } from 'react';
import FormContext from '#form/internal/FormContext';
import useEntry from '#form/internal/useEntry';

/**
 * Registers the {@link control} as a field of the form around it and hands back
 * the wiring for a component that owns its own rendering - a `value`, an
 * `onChange` taking the value itself, and whether a validator holds an error
 * for it.
 *
 * Outside a `FormProvider` it is still wired to the control, but no rule can
 * reach it - `isError` stays `false`, and the error is what the control a
 * validator handed back holds.
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
  control: C
): FieldRenderProps<SelectValue<C>> => {
  const form = useContext(FormContext);

  return useFieldProps(control, form, useEntry(form, control, true));
};

export default useField;
