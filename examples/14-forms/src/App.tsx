/**
 * The form module: validation, submit and dirty tracking over controls you
 * already have.
 *
 * The form does **not** own the values. `useControl` makes the tree, `useForm`
 * is handed it, and reading and writing stay what they are everywhere else -
 * which is why the total below is a `CombinedControlsConsumer` and not something
 * the form provides.
 *
 * Three separate things, each mountable on its own: a **field** is the wiring
 * between a control and an element, a **validator** is a rule that owns the
 * error it wrote, and the **form** is the sweep, the submit and the baseline. A
 * field validates nothing and a validator renders nothing, so a rule can cover
 * controls no field is mounted on - as the duplicate check below does.
 *
 * Every field, rule and state read has to be *under* the `FormProvider`, which
 * is why even a one-input label here is its own component.
 */

import useControl from 'controlla/core/useControl';
import setValue from 'controlla/core/setValue';
import getValue from 'controlla/core/getValue';
import useValue from 'controlla/core/useValue';
import ControlConsumer from 'controlla/core/ControlConsumer';
import CombinedControlsConsumer from 'controlla/core/CombinedControlsConsumer';
import useForm from 'controlla/form/useForm';
import FormProvider from 'controlla/form/FormProvider';
import useNativeField from 'controlla/form/useNativeField';
import NativeField from 'controlla/form/NativeField';
import Field from 'controlla/form/Field';
import useValidator from 'controlla/form/useValidator';
import usePathValidator from 'controlla/form/usePathValidator';
import useFieldArray from 'controlla/form/useFieldArray';
import useFieldState from 'controlla/form/useFieldState';
import useFormState from 'controlla/form/useFormState';
import type { ControlScope, ReadonlyControlScope } from 'controlla/core/types';
import type { ControlErrors } from 'controlla/form/types';
import type { FC } from 'react';

type Line = { label: string; amount: number };

type Claim = {
  payee: string;
  reference: string;
  submittedOn: string;
  method: 'transfer' | 'card' | 'cash';
  lines: Line[];
  notes: string;
  consent: boolean;
};

const EMPTY: Claim = {
  payee: '',
  reference: '',
  submittedOn: '',
  method: 'transfer',
  lines: [{ label: '', amount: 0 }],
  notes: '',
  consent: false,
};

const TAKEN_REFERENCES = ['EXP-1001', 'EXP-1002'];

/** Stands in for a server check, so `$isValidating` has something to report. */
const isReferenceFree = async (reference: string) => {
  await new Promise((resolve) => setTimeout(resolve, 600));

  return !TAKEN_REFERENCES.includes(reference.toUpperCase());
};

const Message: FC<{
  control: ReadonlyControlScope<string | undefined>;
  id?: string;
}> = ({ control, id }) => {
  const message = useValue(control);

  return message ? (
    <span className='error' id={id} role='alert'>
      {message}
    </span>
  ) : null;
};

/** The payee field, wired with the hook and spread onto a plain input. */
const Payee: FC<{ $values: ControlScope<Claim> }> = ({ $values }) => {
  const $error = useValidator(
    $values.payee,
    (payee) => (payee.trim() ? undefined : 'who is being paid?'),
    'blur'
  );

  return (
    <label>
      <span className='muted'>Payee</span>
      <br />
      <input
        {...useNativeField($values.payee, {
          type: 'text',
          errorId: 'payee-error',
        })}
      />
      <br />
      <Message control={$error} id='payee-error' />
    </label>
  );
};

/**
 * Two rules over one field, each with the trigger that suits it - a field never
 * carries the error itself, it only knows *that* it has one, so several rules
 * can cover it.
 *
 * The server rejection is the interesting half. A rule watches every control it
 * is given and answers only for the slots it fills, so `$rejected` is never
 * marked itself: it is there to make the rule run again. It holds the reference
 * that was rejected rather than a boolean, so editing the field clears the error
 * without anything having to reset it. And it is on `'change'`, because a rule
 * left on `'blur'` or `'submit'` holding no error is not watching yet - it would
 * not see the write until the next sweep.
 */
const Reference: FC<{ $values: ControlScope<Claim> }> = ({ $values }) => {
  const $rejected = useControl<string | undefined>(undefined);

  const $takenError = useValidator(
    $values.reference,
    async (reference) =>
      !reference
        ? 'required'
        : (await isReferenceFree(reference))
          ? undefined
          : `${reference} is already claimed`,
    'blur'
  );

  const [$rejectedError] = useValidator(
    [$values.reference, $rejected],
    ([reference, rejected]) => [
      reference && reference === rejected ? 'rejected by finance' : undefined,
      undefined,
    ],
    'change'
  );

  return (
    <label>
      <span className='muted'>Reference</span>
      <br />
      {/* the component form, so the input reacts to its own in-flight check
          without re-rendering anything above it */}
      <NativeField
        type='text'
        control={$values.reference}
        errorId='reference-error'
        render={(props, { $isValidating }) => (
          <>
            <input {...props} placeholder='EXP-1003' />{' '}
            <ControlConsumer control={$isValidating}>
              <span className='muted'>checking…</span>
            </ControlConsumer>
          </>
        )}
      />
      <br />
      <Message control={$takenError} id='reference-error' />
      <Message control={$rejectedError} />
      <button
        type='button'
        onClick={() => setValue($rejected, getValue($values.reference))}
      >
        pretend the server rejected it
      </button>
    </label>
  );
};

const SubmittedOn: FC<{ $values: ControlScope<Claim> }> = ({ $values }) => (
  <label>
    <span className='muted'>Submitted on</span>
    <br />
    <input {...useNativeField($values.submittedOn, { type: 'date' })} />
  </label>
);

const Notes: FC<{ $values: ControlScope<Claim> }> = ({ $values }) => (
  <label>
    <span className='muted'>Notes</span>
    <br />
    <textarea
      {...useNativeField($values.notes, { type: 'textarea' })}
      rows={2}
      style={{ width: '100%' }}
    />
  </label>
);

/** A field over something that is not an input at all - `Field`, not `NativeField`. */
const Method: FC<{ $values: ControlScope<Claim> }> = ({ $values }) => (
  <Field
    control={$values.method}
    render={({ value, onChange, ref, onBlur }) => (
      <div className='row' ref={ref} onBlur={onBlur}>
        <span className='muted'>Method</span>
        {(['transfer', 'card', 'cash'] as const).map((method) => (
          <button
            key={method}
            type='button'
            disabled={value === method}
            onClick={() => onChange(method)}
          >
            {method}
          </button>
        ))}
      </div>
    )}
  />
);

const LineRow: FC<{
  $line: ControlScope<Line>;
  index: number;
  $labelError: ReadonlyControlScope<string | undefined>;
  onRemove(): void;
  onMoveUp(): void;
}> = ({ $line, index, $labelError, onRemove, onMoveUp }) => (
  <li className='row' style={{ marginBottom: '.4rem' }}>
    <NativeField
      type='text'
      control={$line.label}
      render={(props, { $isError }) => (
        <ControlConsumer
          control={$isError}
          render={(isError) => (
            <input
              {...props}
              placeholder='what it was'
              style={{ borderColor: isError ? '#b3261e' : undefined }}
            />
          )}
        />
      )}
    />
    <NativeField
      type='decimal'
      control={$line.amount}
      render={(props) => <input {...props} style={{ width: '7rem' }} />}
    />
    <button type='button' onClick={onRemove}>
      remove
    </button>
    <button type='button' disabled={index === 0} onClick={onMoveUp}>
      up
    </button>
    <Message control={$labelError} />
  </li>
);

/**
 * `useFieldArray` gives the array a key per item, and the key follows its item
 * through an insert or a remove - so a row keeps its identity, and its caret,
 * as the array moves under it.
 *
 * What no single row can answer - which two collide - is a path validator over
 * the array: it reports one error per control that failed, and those controls
 * need no field mounted for the rule to name them.
 */
const Lines: FC<{ $values: ControlScope<Claim> }> = ({ $values }) => {
  const { $keys, append, remove, move } = useFieldArray($values.lines);

  const errorOf = usePathValidator(
    $values.lines,
    (lines) => {
      const seen = new Map<string, number>();

      const errors: ControlErrors<string> = [];

      for (let i = 0; i < lines.length; i++) {
        const label = lines[i].label.trim().toLowerCase();

        if (!label) {
          continue;
        }

        const at = seen.get(label);

        if (at !== undefined) {
          errors.push([$values.lines[at].label, 'duplicate']);

          errors.push([$values.lines[i].label, 'duplicate']);
        } else {
          seen.set(label, i);
        }
      }

      return errors;
    },
    'change'
  );

  /** The array's own error belongs to the array, so it is a plain validator. */
  const $arrayError = useValidator($values.lines, (lines) =>
    lines.some((line) => line.amount > 0)
      ? undefined
      : 'add at least one line with an amount'
  );

  return (
    <>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {useValue($keys).map((key, index) => (
          <LineRow
            key={key}
            index={index}
            $line={$values.lines[index]}
            $labelError={errorOf($values.lines[index].label)}
            onRemove={() => remove(index)}
            onMoveUp={() => move(index, index - 1)}
          />
        ))}
      </ul>
      <Message control={$arrayError} />
      <div className='row'>
        <button type='button' onClick={() => append({ label: '', amount: 0 })}>
          add a line
        </button>
        <span className='muted'>
          total:{' '}
          <CombinedControlsConsumer
            controls={[$values.lines]}
            combiner={(lines) =>
              lines.reduce((sum, line) => sum + (line.amount || 0), 0)
            }
            render={(total) => <strong>{total.toFixed(2)}</strong>}
          />
        </span>
      </div>
    </>
  );
};

const Consent: FC<{ $values: ControlScope<Claim> }> = ({ $values }) => {
  const $error = useValidator($values.consent, (consent) =>
    consent ? undefined : 'the declaration has to be signed'
  );

  /** The state of one field, read without mounting the field itself. */
  const { $isDirty } = useFieldState($values.consent);

  return (
    <>
      <label className='row'>
        <NativeField
          type='checkbox'
          control={$values.consent}
          render={(props) => <input {...props} />}
        />
        <span>I declare the amounts above are correct</span>
        {useValue($isDirty) && <span className='muted'>(touched)</span>}
      </label>
      <Message control={$error} />
    </>
  );
};

/**
 * `useFormState` reaches the same handle `useForm` created, from anywhere under
 * the provider - so a submit bar needs no props threaded down to it.
 */
const SubmitBar: FC = () => {
  const { $isSubmitting, $isValid, $isDirty, $isValidating, reset } =
    useFormState();

  const isSubmitting = useValue($isSubmitting);

  const isValidating = useValue($isValidating);

  const isValid = useValue($isValid);

  const isDirty = useValue($isDirty);

  return (
    <div className='row'>
      <button type='submit' disabled={isSubmitting || isValidating}>
        {isSubmitting ? 'sending…' : isValid ? 'Submit claim' : 'Submit'}
      </button>
      <button type='button' onClick={() => reset()}>
        reset to the baseline
      </button>
      {isDirty && <span className='muted'>unsaved changes</span>}
    </div>
  );
};

const App: FC = () => {
  /**
   * The values are a control like any other - `useControl` here, but a module
   * control, a bag's, or an async control loaded from a server all work. The
   * baseline is whatever this held when the form mounted.
   */
  const $values = useControl(EMPTY);

  const form = useForm($values, {
    async submit(values, changed) {
      console.log('submitting', values, 'changed paths:', changed);

      await new Promise((resolve) => setTimeout(resolve, 800));

      // what was sent is the new baseline, so an edit made while it was in
      // flight stays dirty
      form.reset($values, values);
    },
    submitFailed() {
      console.log('the first invalid field has the focus now');
    },
  });

  return (
    <>
      <h1>Forms</h1>
      <p className='lede'>
        One control tree, rules that own their errors, and a submit that reports
        only what moved.
      </p>

      <FormProvider form={form}>
        {/* submit calls preventDefault on a submit event, so it goes straight
            onto onSubmit */}
        <form onSubmit={form.submit} noValidate>
          <fieldset>
            <legend>Claim</legend>
            <Payee $values={$values} />
            <Reference $values={$values} />
            <SubmittedOn $values={$values} />
            <Method $values={$values} />
          </fieldset>

          <fieldset>
            <legend>Lines</legend>
            <Lines $values={$values} />
          </fieldset>

          <fieldset>
            <legend>Declaration</legend>
            <Notes $values={$values} />
            <Consent $values={$values} />
          </fieldset>

          <SubmitBar />
        </form>
      </FormProvider>

      <fieldset style={{ marginTop: '1rem' }}>
        <legend>What is in the tree</legend>
        <p className='muted' style={{ margin: 0 }}>
          Nothing on the page reads the whole thing, so this is a button rather
          than a subscriber.
        </p>
        <button onClick={() => console.log(getValue($values))}>
          log the values
        </button>
      </fieldset>
    </>
  );
};

export default App;
