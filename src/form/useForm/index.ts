import { useEffect, useRef } from 'react';

import type { Control, SelectValue } from '#types';
import type { FormOptions, FormState } from '#form/types';
import type { FormInternals } from '#form/internal/types';
import makeForm from '#form/internal/makeForm';
import { getEntry, holdEntry, releaseEntry } from '#form/internal/entry';
import { addListener, removeListener } from '#internal/flushQueue';
import { INTERNALS } from '#internal/constants';
import type { AsyncControlInternals, ChangeListener } from '#internal/types';

/**
 * Makes a form over the {@link control}. The fields and validators under its
 * `FormProvider` register with it, and it sweeps, submits and resets them
 * together.
 *
 * The {@link control} is what gets submitted and what `reset` restores, whole -
 * paths no field is mounted on included. `$isValid` comes from the validators
 * that registered, so a rule over some other control still blocks the submit.
 *
 * The form itself lasts as long as the component: the {@link options} are read
 * again on every render, so handlers can close over fresh values, but the
 * {@link control} is read once - a form is over the one control for its life,
 * and a component that has to switch has to remount.
 *
 * `$isDirty` compares against the baseline: what the {@link control} held when
 * the form mounted, then whatever a `reset` left. Only what sits under the
 * {@link control} has one - a field over another control is swept and submitted
 * like the rest, but reads as never dirty. A submit doesn't move it -
 * `reset(control, values)` from the handler is what makes what was sent the new
 * one. Over an async control it is the first value a load hands over, so waiting
 * for data is not an edit and the fields start clean.
 *
 * A reload after that is a value like any other: it overwrites what is being
 * edited and the form reads as dirty against what it first got. Whoever asked
 * for the reload is who knows whether what came back should replace the edits -
 * `reset(control, values)` is how they say so. Disable the fields on
 * `selectLoading` if the control can reload while the form is open.
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
 *       <Validator
 *         control={$values.email}
 *         validate={(email) => (email.includes('@') ? undefined : 'invalid email')}
 *         render={($error) => <ControlConsumer control={$error} />}
 *       />
 *       <NativeField type='email' control={$values.email} render={(props) => <input {...props} />} />
 *     </form>
 *   </FormProvider>
 * );
 * ```
 */
const useForm = <C extends Control>(
  control: C,
  options: FormOptions<SelectValue<C>>
): FormState => {
  const form = (useRef<FormInternals>(null).current ||= makeForm(
    control,
    options
  ));

  form._options = options;

  // the control outlives the form, so what the form holds on it goes when the
  // form does - the load watch it baselines against, and the entry of its own
  // control, which no field of it is there to release. A render that never
  // commits leaves nothing behind, since this is the only thing that runs.
  //
  // After the paint, so what it baselines against is a value nothing of the
  // commit is still going to move
  useEffect(() => {
    const entry = getEntry(form, form._control);

    holdEntry(entry);

    const root = form._control[INTERNALS]._root;

    let listener: ChangeListener | undefined;

    // taken once: an `Activity` hiding the form and showing it again runs this
    // again, and by then the edits are what the value holds
    if (!form._baselined) {
      const value = root._value;

      // the first value a load hands over is the baseline. What comes after it
      // is not the form's business: whoever asked for a reload is who decides
      // whether what it brought is the new baseline. A plain listener, so the
      // form is never what starts the load
      if (
        value === undefined &&
        (root as Partial<AsyncControlInternals>)._errorControl
      ) {
        addListener(
          root,
          (listener = (next) => {
            if (next !== undefined) {
              removeListener(root, listener!);

              listener = undefined;

              form._baseline = next;

              form._baselined = true;
            }
          })
        );
      } else {
        form._baseline = value;

        form._baselined = true;
      }
    }

    return () => {
      releaseEntry(entry);

      if (listener) {
        removeListener(root, listener);
      }
    };
  }, [form]);

  return form;
};

export default useForm;
