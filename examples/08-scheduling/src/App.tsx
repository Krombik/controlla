/**
 * When a write actually commits.
 *
 * By default a write is batched into a microtask: several writes in the same tick
 * become one commit and one render. Pass a scheduler and you choose a different
 * moment instead - after 300ms of quiet, at most once per 200ms, on the next
 * animation frame, or synchronously right now.
 *
 * The commit counters are the point: they count how many times each control
 * actually notified, which is not the same as how many times you called
 * `setValue`.
 */

import createPrimitiveControl from 'controlla/core/createPrimitiveControl';
import createControl from 'controlla/core/createControl';
import useValue from 'controlla/core/useValue';
import setValue from 'controlla/core/setValue';
import getValue from 'controlla/core/getValue';
import watchValue from 'controlla/core/watchValue';
import createDebounceScheduler from 'controlla/scheduler/createDebounceScheduler';
import createThrottleScheduler from 'controlla/scheduler/createThrottleScheduler';
import createManualScheduler from 'controlla/scheduler/createManualScheduler';
import syncScheduler from 'controlla/scheduler/syncScheduler';
import { useEffect, useState, type FC } from 'react';

const $query = createPrimitiveControl('');

const $pointer = createControl({ x: 0, y: 0 });

const $form = createControl({ street: '', city: '', postcode: '' });

const debounced = createDebounceScheduler(300);

const throttled = createThrottleScheduler(200);

/** Commits only when you call `flush()` - useful for "apply" / "cancel" flows. */
const manual = createManualScheduler();

/** Counts commits rather than calls, by watching the control itself. */
const useCommitCount = (
  subscribe: (onCommit: () => void) => () => void
): number => {
  const [count, setCount] = useState(0);

  useEffect(() => subscribe(() => setCount((n) => n + 1)), [subscribe]);

  return count;
};

const subscribeQuery = (onCommit: () => void) => watchValue($query, onCommit);

const subscribePointer = (onCommit: () => void) =>
  watchValue($pointer, onCommit);

const Debounced: FC = () => {
  const commits = useCommitCount(subscribeQuery);

  const [keystrokes, setKeystrokes] = useState(0);

  return (
    <fieldset>
      <legend>Debounce - commit after the typing stops</legend>
      <input
        style={{ width: '100%' }}
        placeholder='type quickly, then pause'
        onChange={(e) => {
          setKeystrokes((n) => n + 1);

          setValue($query, e.target.value, debounced);
        }}
      />
      <p className='muted' style={{ marginBottom: 0 }}>
        {keystrokes} keystrokes → {commits} commits. Committed value:{' '}
        <code>{useValue($query) || '(empty)'}</code>
      </p>
    </fieldset>
  );
};

const Throttled: FC = () => {
  const commits = useCommitCount(subscribePointer);

  const [moves, setMoves] = useState(0);

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
          setMoves((n) => n + 1);

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
  const form = useValue($form);

  const [pending, setPending] = useState(false);

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
            defaultValue={form[field]}
            onChange={(e) => {
              setValue($form[field], e.target.value, manual);

              setPending(true);
            }}
          />
        </label>
      ))}
      <div className='row'>
        <button
          disabled={!pending}
          onClick={() => {
            manual.flush();

            setPending(false);
          }}
        >
          apply
        </button>
        <button
          disabled={!pending}
          onClick={() => {
            // discard: reset the inputs from the last committed value and
            // simply never flush what was staged
            setPending(false);

            window.location.reload();
          }}
        >
          cancel (reloads, to show nothing was committed)
        </button>
      </div>
      <p className='muted' style={{ marginBottom: 0 }}>
        Committed: <code>{JSON.stringify(form)}</code>
      </p>
    </fieldset>
  );
};

const Immediate: FC = () => (
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

const App: FC = () => (
  <>
    <h1>Scheduling</h1>
    <p className='lede'>
      Same <code>setValue</code>, different moment of commit.
    </p>
    <Debounced />
    <Throttled />
    <Manual />
    <Immediate />
  </>
);

export default App;
