/**
 * When a write actually commits.
 *
 * By default a write is batched into a microtask: several writes in the same tick
 * become one commit and one render. Pass a scheduler and you choose a different
 * moment instead - after 300ms of quiet, at most once per 200ms, or synchronously
 * right now.
 *
 * The commit counters are the point: they count how many times each control
 * actually notified, which is not the same as how many times you called
 * `setValue`. They are controls themselves, incremented from a `watchValue` -
 * so what is counted is the commit, not the call.
 *
 * Every control here is made by a hook or a bag, none at module scope: a panel's
 * draft value is nobody else's, and a control that is not really one per app is
 * one the server would have to hand out per request. The schedulers *are*
 * module-level - a debounce is a timer, not state.
 */

import createControl from 'controlla/core/createControl';
import createControlsContext from 'controlla/core/createControlsContext';
import createPrimitiveControl from 'controlla/core/createPrimitiveControl';
import usePrimitiveControl from 'controlla/core/usePrimitiveControl';
import useControl from 'controlla/core/useControl';
import setValue from 'controlla/core/setValue';
import getValue from 'controlla/core/getValue';
import useValue from 'controlla/core/useValue';
import watchValue from 'controlla/core/watchValue';
import createDebounceScheduler from 'controlla/scheduler/createDebounceScheduler';
import createThrottleScheduler from 'controlla/scheduler/createThrottleScheduler';
import createManualScheduler from 'controlla/scheduler/createManualScheduler';
import syncScheduler from 'controlla/scheduler/syncScheduler';
import type { Control } from 'controlla/core/types';
import { useEffect, type FC } from 'react';

const debounced = createDebounceScheduler(300);

const throttled = createThrottleScheduler(200);

/** Commits only when you call `flush()` - useful for "apply" / "cancel" flows. */
const manual = createManualScheduler();

/**
 * The address is the one thing two panels share, so it is a bag rather than a
 * hook - `Manual` stages writes into it and `Immediate` commits straight to it.
 * `createControls` runs once inside a branch, so it is `create*` in here, never
 * the `use*` hooks.
 */
const [AddressProvider, useAddress] = createControlsContext(() => ({
  $form: createControl({ street: '', city: '', postcode: '' }),
  $pending: createPrimitiveControl(false),
}));

const count = (control: Control<number>) => setValue(control, (n) => n + 1);

/**
 * A commit is exactly what `watchValue` reports, so watching the control is the
 * honest tally. It returns its own unwatch, which is the whole effect.
 */
const useCommitCount = (control: Control<any>) => {
  const $commits = usePrimitiveControl(0);

  useEffect(
    () => watchValue(control, () => count($commits)),
    [control, $commits]
  );

  return useValue($commits);
};

const Debounced: FC = () => {
  const $query = usePrimitiveControl('');

  const $keystrokes = usePrimitiveControl(0);

  const commits = useCommitCount($query);

  return (
    <fieldset>
      <legend>Debounce - commit after the typing stops</legend>
      <input
        style={{ width: '100%' }}
        placeholder='type quickly, then pause'
        onChange={(e) => {
          count($keystrokes);

          setValue($query, e.target.value, debounced);
        }}
      />
      <p className='muted' style={{ marginBottom: 0 }}>
        {useValue($keystrokes)} keystrokes → {commits} commits. Committed value:{' '}
        <code>{useValue($query) || '(empty)'}</code>
      </p>
    </fieldset>
  );
};

const Throttled: FC = () => {
  const $pointer = useControl({ x: 0, y: 0 });

  const $moves = usePrimitiveControl(0);

  const commits = useCommitCount($pointer);

  const moves = useValue($moves);

  const { x, y } = useValue($pointer);

  return (
    <fieldset>
      <legend>Throttle - at most one commit per 200ms</legend>
      <div
        style={{
          height: '6rem',
          border: '1px dashed #8886',
          borderRadius: 6,
          display: 'grid',
          placeItems: 'center',
        }}
        onPointerMove={(e) => {
          count($moves);

          setValue(
            $pointer,
            { x: Math.round(e.clientX), y: Math.round(e.clientY) },
            throttled
          );
        }}
      >
        <span className='muted'>move the pointer in here</span>
      </div>
      <p className='muted' style={{ marginBottom: 0 }}>
        {moves} events → {commits} commits. Last: {x}, {y}
      </p>
    </fieldset>
  );
};

const Manual: FC = () => {
  const { $form, $pending } = useAddress();

  const pending = useValue($pending);

  return (
    <fieldset>
      <legend>Manual - commit when you say so</legend>
      <p className='muted'>
        These inputs write on the manual scheduler, so nothing lands until you
        apply. Cancelling just never flushes.
      </p>
      {(['street', 'city', 'postcode'] as const).map((field) => (
        <label key={field}>
          <span className='muted'>{field}</span>
          <br />
          <input
            // uncontrolled: the element holds what was typed, the control holds
            // what was committed, and the gap between them is the whole point
            defaultValue={getValue($form[field])}
            onChange={(e) => {
              setValue($form[field], e.target.value, manual);

              setValue($pending, true);
            }}
          />
        </label>
      ))}
      <div className='row'>
        <button
          disabled={!pending}
          onClick={() => {
            manual.flush();

            setValue($pending, false);
          }}
        >
          apply
        </button>
        <button
          disabled={!pending}
          onClick={() => {
            // discard: reset the inputs from the last committed value and
            // simply never flush what was staged
            setValue($pending, false);

            window.location.reload();
          }}
        >
          cancel (reloads, to show nothing was committed)
        </button>
      </div>
      <p className='muted' style={{ marginBottom: 0 }}>
        Committed: <code>{JSON.stringify(useValue($form))}</code>
      </p>
    </fieldset>
  );
};

const Immediate: FC = () => {
  const { $form } = useAddress();

  return (
    <fieldset>
      <legend>Batching, and opting out of it</legend>
      <div className='row'>
        <button
          onClick={() => {
            // three writes, one commit - the default microtask batch
            setValue($form.street, '14 Rua da Prata');
            setValue($form.city, 'Lisbon');
            setValue($form.postcode, '1100-052');

            console.log('after the calls, before the flush:', getValue($form));
          }}
        >
          three writes, one commit
        </button>
        <button
          onClick={() => {
            setValue($form.city, 'Porto', syncScheduler);

            // already committed by the time this line runs
            console.log('sync, already committed:', getValue($form.city));
          }}
        >
          syncScheduler - commit now
        </button>
      </div>
      <p className='muted' style={{ marginBottom: 0 }}>
        Check the console: the default batch has not committed yet on the line
        after the writes, and the sync one has.
      </p>
    </fieldset>
  );
};

const App: FC = () => (
  <>
    <h1>Scheduling</h1>
    <p className='lede'>
      Same <code>setValue</code>, different moment of commit.
    </p>
    <Debounced />
    <Throttled />
    {/* the two that share an address */}
    <AddressProvider>
      <Manual />
      <Immediate />
    </AddressProvider>
  </>
);

export default App;
