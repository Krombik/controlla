/**
 * Async data as state.
 *
 * `createAsyncControl` with a loader is a value that fetches itself: the request
 * starts the first time something uses it, and the control carries its own
 * loading / ready / error status. Nothing here writes an effect, holds an
 * `isLoading` boolean or guards against a response arriving after unmount.
 *
 * Both panels below read the *same* control two different ways - suspending and
 * not - and there is still only one request.
 */

import createAsyncControl from 'controlla/core/createAsyncControl';
import requestLoader from 'controlla/loader/requestLoader';
import SuspenseControlConsumer from 'controlla/core/SuspenseControlConsumer';
import ControlsConsumer from 'controlla/core/ControlsConsumer';
import selectLoading from 'controlla/core/selectLoading';
import selectError from 'controlla/core/selectError';
import selectReady from 'controlla/core/selectReady';
import invalidate from 'controlla/core/invalidate';
import toPromise from 'controlla/core/toPromise';
import type { FC } from 'react';

type Status = {
  region: string;
  uptimePercent: number;
  incidents: number;
  checkedAt: string;
};

let attempt = 0;

let failNext = false;

/** Stands in for a real endpoint: slow, and able to fail on demand. */
const fetchStatus = async (): Promise<Status> => {
  await new Promise((resolve) => setTimeout(resolve, 700));

  if (failNext) {
    failNext = false;

    throw new Error('status endpoint returned 503');
  }

  attempt++;

  return {
    region: 'eu-west-1',
    uptimePercent: 99.9 - attempt * 0.01,
    incidents: attempt % 3,
    checkedAt: new Date().toLocaleTimeString(),
  };
};

const $status = createAsyncControl(requestLoader(fetchStatus));

/** Suspending read: the fallback shows until there is a value. */
const Card: FC = () => (
  <SuspenseControlConsumer
    control={$status}
    fallback={<p className='muted'>Loading status…</p>}
    renderIfError={(error: Error) => (
      <>
        <p style={{ color: '#b3261e' }}>{error.message}</p>
        <button onClick={() => invalidate($status)}>retry</button>
      </>
    )}
    render={(status) => (
      <>
        <p style={{ margin: 0 }}>
          <strong>{status.region}</strong> - {status.uptimePercent.toFixed(2)}%
          uptime, {status.incidents} open incidents
        </p>
        <p className='muted' style={{ margin: '.3rem 0 0' }}>
          checked at {status.checkedAt}
        </p>
      </>
    )}
  />
);

/**
 * Non-suspending read of the same control. `selectLoading`, `selectError` and
 * `selectReady` are controls too, so this tracks status without ever reading the
 * value - and without a second request.
 */
const StatusFlags: FC = () => (
  <ControlsConsumer
    controls={[
      selectLoading($status),
      selectReady($status),
      selectError($status),
    ]}
    render={(isLoading, isReady, error) => (
      <ul className='muted' style={{ margin: 0 }}>
        <li>loading: {String(isLoading)}</li>
        <li>ready: {String(!!isReady)}</li>
        <li>error: {error ? (error as Error).message : 'none'}</li>
      </ul>
    )}
  />
);

const App: FC = () => (
  <>
    <h1>Async control</h1>
    <p className='lede'>
      One self-fetching value. The panels read it two different ways and share a
      single request.
    </p>

    {/* no Suspense boundary of our own: SuspenseControlConsumer is one */}
    <fieldset>
      <legend>Suspending read</legend>
      <Card />
    </fieldset>

    <fieldset>
      <legend>Status, without reading the value</legend>
      <StatusFlags />
    </fieldset>

    <fieldset>
      <legend>Refetching</legend>
      <div className='row'>
        <button onClick={() => invalidate($status)}>
          invalidate - clears the value, so the fallback comes back
        </button>
        <button onClick={() => invalidate($status, true)}>
          invalidate silently - keeps showing the old value while reloading
        </button>
      </div>
      <p className='muted'>
        Silent invalidation is stale-while-revalidate: watch the flags say
        <code> loading: true</code> while the card keeps its content.
      </p>
    </fieldset>

    <fieldset>
      <legend>Errors, and awaiting a value</legend>
      <div className='row'>
        <button
          onClick={() => {
            failNext = true;

            invalidate($status);
          }}
        >
          make the next request fail
        </button>
        <button
          onClick={() =>
            // a promise for the current value, for code that is not a component
            toPromise($status).then(
              (status) => console.log('resolved', status),
              (error) => console.log('rejected', error)
            )
          }
        >
          toPromise, logged to the console
        </button>
      </div>
    </fieldset>
  </>
);

export default App;
