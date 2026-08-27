/**
 * The smallest thing there is: one value, read and written from two components.
 *
 * A control is not React state - it is a plain object that happens to be
 * subscribable, so passing it down is passing a reference, not a value, and a
 * component reading it re-renders while the ones handing it over do not. That is
 * the whole setup: no store, no reducer, no selector.
 *
 * `usePrimitiveControl` scopes it to the component that made it, which is the
 * right default. Module scope is for what is genuinely one per app - see
 * `13-controls-context` for where each belongs.
 */

import usePrimitiveControl from 'controlla/core/usePrimitiveControl';
import useValue from 'controlla/core/useValue';
import setValue from 'controlla/core/setValue';
import getValue from 'controlla/core/getValue';
import type { Control } from 'controlla/core/types';
import type { FC } from 'react';

type Props = { $count: Control<number> };

const Display: FC<Props> = ({ $count }) => {
  // subscribes; re-renders when the value changes
  const count = useValue($count);

  return <output>{count}</output>;
};

const Buttons: FC<Props> = ({ $count }) => (
  <div className='row'>
    {/* a plain value... */}
    <button onClick={() => setValue($count, 0)}>reset</button>
    {/* ...or an updater, which receives the previous value */}
    <button onClick={() => setValue($count, (n) => n - 1)}>-1</button>
    <button onClick={() => setValue($count, (n) => n + 1)}>+1</button>
  </div>
);

const App: FC = () => {
  /* `usePrimitiveControl` is for values with no fields to subscribe to
   *  individually - numbers, strings, booleans. Use `useControl` for objects. */
  const $count = usePrimitiveControl(0);

  return (
    <>
      <h1>Counter</h1>
      <p className='lede'>
        One control at module scope, two components reading and writing it.
      </p>

      <fieldset>
        <legend>Count</legend>
        <p style={{ fontSize: '2rem', margin: '0 0 .75rem' }}>
          <Display $count={$count} />
        </p>
        <Buttons $count={$count} />
      </fieldset>

      <fieldset>
        <legend>Outside React</legend>
        <p className='muted'>
          Nothing about a control is React-specific - no hook is involved in
          reading or writing one. This button is a plain listener.
        </p>
        <button
          onClick={() => {
            // getValue reads once without subscribing - what you want in handlers
            const doubled = getValue($count) * 2;

            setValue($count, doubled);

            console.log('doubled to', doubled);
          }}
        >
          double it
        </button>
      </fieldset>
    </>
  );
};

export default App;
