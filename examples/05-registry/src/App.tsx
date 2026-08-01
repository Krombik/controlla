/**
 * One control per key.
 *
 * A registry is the async control from the previous example, multiplied by a key:
 * `packageRegistry.get('kafka')` is that package's control, created the first
 * time it is asked for and cached after. Two components asking for the same key
 * get the same control and share one request.
 *
 * `bind` is the part worth understanding. `.get(key)` takes a value; `.bind($key)`
 * takes a *control* and returns one that follows it. Change the selected package
 * and the bound control re-points - nothing re-runs a fetch by hand.
 */

import createRegistry from 'controlla/core/createRegistry';
import createAsyncControl from 'controlla/core/createAsyncControl';
import createPrimitiveControl from 'controlla/core/createPrimitiveControl';
import requestLoader from 'controlla/loader/requestLoader';
import Suspense from 'controlla/core/Suspense';
import SuspenseControlConsumer from 'controlla/core/SuspenseControlConsumer';
import ControlConsumer from 'controlla/core/ControlConsumer';
import setValue from 'controlla/core/setValue';
import selectLoading from 'controlla/core/selectLoading';
import invalidate from 'controlla/core/invalidate';
import type { FC } from 'react';

type PackageInfo = {
  name: string;
  version: string;
  weeklyDownloads: number;
  license: string;
  maintainers: string[];
};

const NAMES = ['kafka-client', 'grid-router', 'ledger-core', 'atlas-cache'];

const requestCounts: Record<string, number> = {};

const stringToNumber = (str: string) =>
  [...str].reduce((sum, char) => sum + char.charCodeAt(0), 0);

const fetchPackage = async (name: string): Promise<PackageInfo> => {
  requestCounts[name] = (requestCounts[name] || 0) + 1;

  await new Promise((resolve) => setTimeout(resolve, 600));

  const seed = stringToNumber(name);

  return {
    name,
    version: `${seed % 4}.${seed % 7}.${seed % 3}`,
    weeklyDownloads: seed * 1243,
    license: seed % 2 ? 'Apache-2.0' : 'MIT',
    maintainers: ['r.okafor', 's.lindqvist'].slice(0, (seed % 2) + 1),
  };
};

const packageRegistry = createRegistry(
  createAsyncControl,
  requestLoader(fetchPackage)
);

const $selected = createPrimitiveControl(NAMES[0]);

/**
 * Follows `$selected`. Declared once, at module scope - not rebuilt per render.
 */
const $current = packageRegistry.bind($selected);

const Details: FC = () => (
  <SuspenseControlConsumer
    control={$current}
    fallback={<p className='muted'>Loading…</p>}
    render={(info) => (
      <>
        <p style={{ margin: 0 }}>
          <strong>{info.name}</strong> {info.version} - {info.license}
        </p>
        <p className='muted' style={{ margin: '.3rem 0 0' }}>
          {info.weeklyDownloads.toLocaleString()} weekly downloads - maintained
          by {info.maintainers.join(', ')}
        </p>
      </>
    )}
  />
);

/** Reads a single field of the bound control - re-renders only when it changes. */
const VersionOnly: FC = () => (
  <ControlConsumer
    control={$current.version}
    render={(version) => <code>{version ?? '…'}</code>}
  />
);

const App: FC = () => {
  return (
    <>
      <h1>Registry</h1>
      <p className='lede'>
        One control per package name. Switch back and forth - the second visit
        is instant, and the request count does not move.
      </p>

      <fieldset>
        <legend>Pick a package</legend>
        <div className='row'>
          {NAMES.map((name) => (
            <ControlConsumer
              control={$selected}
              render={(selected) => (
                <button
                  key={name}
                  disabled={name === selected}
                  onClick={() => setValue($selected, name)}
                >
                  {name}
                </button>
              )}
            />
          ))}
        </div>
      </fieldset>

      <Suspense fallback={null}>
        <fieldset>
          <legend>Bound to the selection</legend>
          <Details />
          <p className='muted' style={{ marginBottom: 0 }}>
            version, as its own subscriber: <VersionOnly />
          </p>
        </fieldset>
      </Suspense>

      <fieldset>
        <legend>Requests actually made</legend>
        {/* re-rendered on every load so the tally stays honest */}
        <ControlConsumer
          control={selectLoading($current)}
          render={() => (
            <ul className='muted' style={{ margin: 0 }}>
              {NAMES.map((name) => (
                <li key={name}>
                  {name}: {requestCounts[name] || 0}
                </li>
              ))}
            </ul>
          )}
        />
        <div className='row' style={{ marginTop: '.75rem' }}>
          <button onClick={() => invalidate($current)}>
            invalidate the selected one
          </button>
        </div>
      </fieldset>
    </>
  );
};

export default App;
