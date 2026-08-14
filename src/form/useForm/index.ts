import { useRef } from 'react';

import type { Control, SelectValue } from '#types';
import type { FormOptions, FormState } from '#form/types';
import type { FormInternals } from '#form/internal/types';
import makeForm from '#form/internal/makeForm';

/**
 * Creates a form over the {@link control}: a registry the `Field`s under its
 * `FormProvider` attach their validators to, plus the submit orchestration
 * over them.
 *
 * The attachment is loose. The {@link control} is what gets submitted and
 * what `reset` restores - including paths no field is mounted on - while
 * validation, `$isValid` and the submit sweep come from whatever registered,
 * so a field over some other control still takes part.
 *
 * The handle is created once and kept for the component's whole life, while
 * the {@link options} are re-read on every render. The baseline is taken when
 * the form is created, or - for an async {@link control} - when its value
 * first arrives, and moves to whatever a successful submit or a `reset` wrote.
 *
 * @example
 * ```tsx
 * const $values = useControl({ email: '' });
 *
 * const form = useForm($values, {
 *   validateOn: 'blur',
 *   submit: (values) => api.save(values),
 * });
 *
 * return (
 *   <FormProvider form={form}>
 *     <form onSubmit={form.submit}>
 *       <Field
 *         control={$values.email}
 *         validate={(email) => (email.includes('@') ? undefined : 'invalid email')}
 *         render={(props, { $error }) => (
 *           <input {...props} value={useValue($values.email)} />
 *         )}
 *       />
 *     </form>
 *   </FormProvider>
 * );
 * ```
 */
const useForm = <C extends Control, E = any>(
  control: C,
  options: FormOptions<SelectValue<C>, E>
): FormState => {
  const ref = useRef<FormInternals>(null);

  const form = (ref.current ||= makeForm(control, options));

  form._options = options;

  return form;
};

export default useForm;
