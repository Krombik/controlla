/**
 * Controls backed by storage.
 *
 * Persistence is a second argument, not an API you call: `$preferences` is read
 * and written exactly like any other control, and the storage is kept in sync
 * behind it. The write also propagates to other tabs, because the storage is
 * observed - open this page twice and change something.
 *
 * Open devtools > Application > Local Storage to watch the keys change.
 */

import createControl from 'controlla/core/createControl';
import createPrimitiveControl from 'controlla/core/createPrimitiveControl';
import getPersistStorage from 'controlla/persist/getPersistStorage';
import safeLocalStorage from 'controlla/persist/safeLocalStorage';
import safeSessionStorage from 'controlla/persist/safeSessionStorage';
import useValue from 'controlla/core/useValue';
import setValue from 'controlla/core/setValue';
import type { FC } from 'react';

type Preferences = {
  theme: 'system' | 'light' | 'dark';
  density: 'comfortable' | 'compact';
  pageSize: number;
};

const DEFAULTS: Preferences = {
  theme: 'system',
  density: 'comfortable',
  pageSize: 25,
};

/**
 * `isValid` is the version guard. Anything a previous build wrote that no longer
 * matches this shape is discarded and the default is used instead, so a renamed
 * field can never crash a reader on someone's stale storage.
 */
const $preferences = createControl<Preferences>(
  DEFAULTS,
  getPersistStorage({
    name: 'controlla.example.preferences',
    storage: safeLocalStorage,
    isValid(value) {
      return (
        !!value &&
        ['system', 'light', 'dark'].includes(value.theme) &&
        ['comfortable', 'compact'].includes(value.density) &&
        typeof value.pageSize === 'number'
      );
    },
  })
);

/**
 * Session storage instead, for something that should not outlive the tab.
 * `getPersistStorage` returns `undefined` if the storage is unavailable - in
 * private modes, or with cookies blocked - and the control simply stays
 * in-memory rather than throwing.
 */
const $draft = createPrimitiveControl(
  '',
  getPersistStorage({
    name: 'controlla.example.draft',
    storage: safeSessionStorage,
  })
);

const ThemePicker: FC = () => {
  const theme = useValue($preferences.theme);

  return (
    <label>
      <span className='muted'>Theme</span>
      <br />
      <select
        value={theme}
        onChange={(e) =>
          setValue($preferences.theme, e.target.value as Preferences['theme'])
        }
      >
        <option value='system'>follow the system</option>
        <option value='light'>light</option>
        <option value='dark'>dark</option>
      </select>
    </label>
  );
};

const DensityToggle: FC = () => (
  <label className='row'>
    <input
      type='checkbox'
      checked={useValue($preferences.density) === 'compact'}
      onChange={(e) =>
        setValue(
          $preferences.density,
          e.target.checked ? 'compact' : 'comfortable'
        )
      }
    />
    <span>Compact rows</span>
  </label>
);

const PageSize: FC = () => {
  const pageSize = useValue($preferences.pageSize);

  return (
    <label>
      <span className='muted'>Rows per page</span>
      <br />
      <input
        type='number'
        min={5}
        max={200}
        step={5}
        value={pageSize}
        onChange={(e) =>
          setValue($preferences.pageSize, Number(e.target.value) || 5)
        }
      />
    </label>
  );
};

const Draft: FC = () => {
  const draft = useValue($draft);

  return (
    <label>
      <span className='muted'>
        Survives a reload, but not a new tab (session storage)
      </span>
      <br />
      <input
        style={{ width: '100%' }}
        value={draft}
        placeholder='start typing, then reload'
        onChange={(e) => setValue($draft, e.target.value)}
      />
    </label>
  );
};

const App: FC = () => (
  <>
    <h1>Persistence</h1>
    <p className='lede'>
      Change something, then reload. Then open this page in a second tab and
      change it there.
    </p>

    <fieldset>
      <legend>Preferences (local storage, shared between tabs)</legend>
      <ThemePicker />
      <DensityToggle />
      <PageSize />
    </fieldset>

    <fieldset>
      <legend>Draft (session storage, per tab)</legend>
      <Draft />
    </fieldset>

    <fieldset>
      <legend>Starting over</legend>
      <button onClick={() => setValue($preferences, DEFAULTS)}>
        reset to defaults
      </button>
      <p className='muted' style={{ marginBottom: 0 }}>
        Writing the defaults back is all "reset" means - there is no separate
        clear step, because the control and the storage are the same value.
      </p>
    </fieldset>
  </>
);

export default App;
