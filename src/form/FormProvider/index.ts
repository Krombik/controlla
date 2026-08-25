import type { FC, PropsWithChildren } from 'react';

import type { FormState } from '#form/types';
import type { FormInternals } from '#form/internal/types';
import FormContext from '#form/internal/FormContext';
import { jsx } from 'react/jsx-runtime';

export type FormProviderProps = PropsWithChildren<{
  form: FormState;
}>;

/**
 * Exposes the {@link FormProviderProps.form form} to the fields, validators
 * and `useFieldState`/`useFormState` calls under it. Every one of them needs
 * it: outside any provider they throw.
 */
const FormProvider: FC<FormProviderProps> = (props) =>
  jsx(FormContext.Provider, {
    value: props.form as FormInternals,
    children: props.children,
  });

export default FormProvider;
