import { useContext } from 'react';

import type { FormState } from '#form/types';
import FormContext from '#form/internal/FormContext';

const throwNoProvider = (): never => {
  throw new Error('no form provider');
};

/**
 * The enclosing form, so `$isSubmitting`, `$isValid`, `$isDirty` and `submit`
 * are there without passing them down. Throws outside a `FormProvider`.
 *
 * @example
 * ```tsx
 * const { $isSubmitting, $isValid } = useFormState();
 *
 * return <button disabled={useValue($isSubmitting) || !useValue($isValid)}>Save</button>;
 * ```
 */
const useFormState = (): FormState =>
  useContext(FormContext) || throwNoProvider();

export default useFormState;
