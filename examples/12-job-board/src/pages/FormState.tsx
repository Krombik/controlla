/**
 * Local state, nothing async, no router. An application form: three inputs and
 * a summary, sharing one control tree that lives outside React.
 *
 * The counters are the point. Type in one field and only that field's component
 * re-renders - its siblings hold their count, even though all four read from the
 * same `$application`. There is no selector and no memo doing that;
 * `useValue($application.candidate.email)` subscribes to that path and nothing
 * wider. The bag below is only where the tree is declared - it is a plain
 * `createContext` holding one value that never changes, so it re-renders
 * nothing itself.
 */

import createControl from 'controlla/core/createControl';
import createControlsContext from 'controlla/core/createControlsContext';
import useValue from 'controlla/core/useValue';
import setValue from 'controlla/core/setValue';
import getValue from 'controlla/core/getValue';
import ControlConsumer from 'controlla/core/ControlConsumer';
import CombinedControlsConsumer from 'controlla/core/CombinedControlsConsumer';
import { useRef, type FC } from 'react';

/**
 * A bag, not a module control. Nothing about a half-filled form is global -
 * leave the page and it should be gone - and a bag is what keeps it that way:
 * built once per mounted provider, so two of these on one screen would not share
 * a word of it. Module scope is for what really is one per app: the registries,
 * the URL, the DOM controls.
 *
 * `createControls` runs once, inside a branch - so it is the `create*` calls
 * that go in here, never the `use*` hooks.
 */
const [ApplicationProvider, useApplication] = createControlsContext(() => ({
  $application: createControl({
    candidate: { name: '', email: '' },
    answers: { years: 0, notice: '2 weeks' },
    consent: false,
  }),
}));

/** Shows how often this component actually rendered. */
const useRenderCount = () => {
  const count = useRef(0);

  count.current++;

  return count.current;
};

const Renders: FC<{ of: string }> = ({ of }) => (
  <span className='renders'>
    {of} renders: {useRenderCount()}
  </span>
);

const NameField: FC = () => {
  const { $application } = useApplication();

  const name = useValue($application.candidate.name);

  return (
    <div className='card'>
      <Renders of='NameField' />
      <label>
        <span>Full name</span>
        <input
          value={name}
          onChange={(e) =>
            setValue($application.candidate.name, e.target.value)
          }
        />
      </label>
    </div>
  );
};

const EmailField: FC = () => {
  const { $application } = useApplication();

  const email = useValue($application.candidate.email);

  return (
    <div className='card'>
      <Renders of='EmailField' />
      <label>
        <span>Email</span>
        <input
          value={email}
          onChange={(e) =>
            setValue($application.candidate.email, e.target.value)
          }
        />
      </label>
    </div>
  );
};

const YearsField: FC = () => {
  const { $application } = useApplication();

  const years = useValue($application.answers.years);

  return (
    <div className='card'>
      <Renders of='YearsField' />
      <label>
        <span>Years of experience</span>
        <input
          type='number'
          min={0}
          value={years}
          // an updater gets the previous value, like setValue's second overload
          onChange={(e) =>
            setValue($application.answers.years, Number(e.target.value) || 0)
          }
        />
      </label>
      <div className='row'>
        <button
          onClick={() => setValue($application.answers.years, (n) => n + 1)}
        >
          +1 year
        </button>
        <button
          onClick={() =>
            // writing a whole subtree notifies only the fields that changed:
            // `notice` moves, `years` does not, so YearsField stays put
            setValue($application.answers, (prev) => ({
              ...prev,
              notice: prev.notice === '2 weeks' ? '1 month' : '2 weeks',
            }))
          }
        >
          toggle notice period
        </button>
      </div>
    </div>
  );
};

const ConsentField: FC = () => {
  const { $application } = useApplication();

  return (
    <label className='row'>
      <input
        type='checkbox'
        checked={useValue($application.consent)}
        onChange={(e) => setValue($application.consent, e.target.checked)}
      />
      <span style={{ margin: 0 }}>I agree to the data processing terms</span>
    </label>
  );
};

const Summary: FC = () => {
  const { $application } = useApplication();

  return (
    <div className='card'>
      <Renders of='Summary' />
      <h2>Summary</h2>
      {/* ControlConsumer keeps the subscription inside itself, so a change
          re-renders this block instead of the whole page */}
      <p>
        Notice period: <ControlConsumer control={$application.answers.notice} />
      </p>
      {/* derives one boolean from three fields and re-renders only when that
          boolean flips - not on every keystroke */}
      <ConsentField />
      <CombinedControlsConsumer
        controls={[
          $application.candidate.name,
          $application.candidate.email,
          $application.consent,
        ]}
        combiner={(name, email, consent) =>
          name.trim().length > 1 && email.includes('@') && consent
        }
        render={(isComplete) => (
          <button
            disabled={!isComplete}
            onClick={() => {
              // getValue reads once without subscribing - right for handlers
              console.log('submitting', getValue($application));
            }}
          >
            {isComplete ? 'Submit application' : 'Fill the form to submit'}
          </button>
        )}
      />
    </div>
  );
};

const FormState: FC = () => (
  <ApplicationProvider>
    <h1>Local state</h1>
    <p className='lede'>
      One control tree, four subscribers. Watch the render counters as you type
      - only the field you touch goes up.
    </p>

    <NameField />
    <EmailField />
    <YearsField />
    <Summary />
  </ApplicationProvider>
);

export default FormState;
