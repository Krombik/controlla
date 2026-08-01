/**
 * Why nested controls matter.
 *
 * `createControl`/`useControl` gives you a tree: `$profile.contact.email` is a control in its
 * own right, and subscribing to it subscribes to that field alone. The render
 * counters are the proof - type in one input and only its component's count
 * moves, even though all of them read from the same `$profile`.
 *
 * There is no selector, no memo and no context doing that. A write diffs the new
 * value against the old and notifies only the paths that actually changed.
 */

import useControl from 'controlla/core/useControl';
import useValue from 'controlla/core/useValue';
import setValue from 'controlla/core/setValue';
import ControlConsumer from 'controlla/core/ControlConsumer';
import type { Control } from 'controlla/core/types';
import { useRef, type FC } from 'react';

const Renders: FC<{ of: string }> = ({ of }) => {
  const rerenderCountRef = useRef(0);

  rerenderCountRef.current++;

  return (
    <span className='count'>
      {of}: {rerenderCountRef.current}
    </span>
  );
};

/** Each field component subscribes to exactly one leaf. */
const Field: FC<{ label: string; $control: Control<string> }> = ({
  label,
  $control,
}) => (
  <p>
    <Renders of={label} />
    <label>
      <span className='muted'>{label}</span>
      <br />
      <input
        value={useValue($control)}
        onChange={(e) => setValue($control, e.target.value)}
      />
    </label>
  </p>
);

const App: FC = () => {
  const $profile = useControl({
    contact: { name: 'Dana Whitfield', email: 'dana@example.com' },
    address: { city: 'Lisbon', country: 'PT' },
    tags: ['typescript', 'go'],
  });

  return (
    <>
      <h1>Nested control</h1>
      <p className='lede'>
        One tree, five subscribers. Type in any field and watch the other
        counters stay where they are.
      </p>

      <fieldset>
        <legend>Contact</legend>
        <Field label='name' $control={$profile.contact.name} />
        <Field label='email' $control={$profile.contact.email} />
      </fieldset>

      <fieldset>
        <legend>Address</legend>
        <Field label='city' $control={$profile.address.city} />
        <Field label='country' $control={$profile.address.country} />
      </fieldset>

      <fieldset>
        <legend>Writing a whole subtree</legend>
        <p className='muted'>
          Replacing an object still notifies only what differs: this changes
          <code> city</code> but leaves <code>country</code> alone, so only the
          city counter moves.
        </p>
        <div className='row'>
          <button
            onClick={() =>
              setValue($profile.address, (prev) => ({
                ...prev,
                city: prev.city === 'Lisbon' ? 'Porto' : 'Lisbon',
              }))
            }
          >
            toggle city via the parent
          </button>
          <button
            onClick={() =>
              // an identical value is not a change at all - no counter moves
              setValue($profile.address, (prev) => ({ ...prev }))
            }
          >
            write an equal value
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Arrays</legend>
        <p>
          <ControlConsumer
            control={$profile.tags}
            render={(tags) => (
              <>
                <Renders of='tags' />
                {tags.join(', ')}
              </>
            )}
          />
        </p>
        <p>
          {/* `.length` is its own control, and changes only when the count does */}
          <ControlConsumer
            control={$profile.tags.length}
            render={(length) => (
              <>
                <Renders of='tags' />
                {length} tags
              </>
            )}
          />
        </p>
        <div className='row'>
          <button
            onClick={() => setValue($profile.tags, (tags) => [...tags, 'new'])}
          >
            add
          </button>
          <button
            onClick={() => setValue($profile.tags, (tags) => tags.slice(0, -1))}
          >
            remove
          </button>
          <button
            onClick={() =>
              // index 0 changes, the length does not - the counter above holds
              setValue($profile.tags[0], (tag) => tag.toUpperCase())
            }
          >
            shout the first tag
          </button>
        </div>
      </fieldset>
    </>
  );
};

export default App;
