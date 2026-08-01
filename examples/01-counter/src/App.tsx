/**
 * The smallest thing there is: one value, read and written from two components.
 *
 * The control lives at module scope, not in a component. That is the whole
 * setup - no provider, no context, no store to create. Anything that can import
 * `$count` can read or write it, including code outside React.
 */

import createPrimitiveControl from 'controlla/core/createPrimitiveControl';
import useValue from 'controlla/core/useValue';
import setValue from 'controlla/core/setValue';
import getValue from 'controlla/core/getValue';
import type { FC } from 'react';

/* `createPrimitiveControl` is for values with no fields to subscribe to
 *  individually - numbers, strings, booleans. Use `createControl` for objects. */
const $count = createPrimitiveControl(0);

const Display: FC = () => {
  // subscribes; re-renders when the value changes
  const count = useValue($count);

  return <output>{count}</output>;
};

const Buttons: FC = () => (
  <div className='row'>
    {/* a plain value... */}
    <button onClick={() => setValue($count, 0)}>reset</button>
    {/* ...or an updater, which receives the previous value */}
    <button onClick={() => setValue($count, (n) => n - 1)}>-1</button>
    <button onClick={() => setValue($count, (n) => n + 1)}>+1</button>
  </div>
);

const App: FC = () => (
  <>
    <h1>Counter</h1>
    <p className='lede'>
      One control at module scope, two components reading and writing it.
    </p>

    <fieldset>
      <legend>Count</legend>
      <p style={{ fontSize: '2rem', margin: '0 0 .75rem' }}>
        <Display />
      </p>
      <Buttons />
    </fieldset>

    <fieldset>
      <legend>Outside React</legend>
      <p className='muted'>
        Nothing about a control is React-specific. This button is a plain
        listener that happens to write the same value.
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

export default App;
