/**
 * One control per key, and the four ways you read it.
 *
 * Nothing here calls `fetch`, holds a loading flag or writes an effect. Asking
 * for `listingRegistry.get(id)` and rendering it is the whole data layer: the
 * request starts on first use, is deduped between components, and stays cached
 * for the next reader.
 */

import SuspenseControlConsumer from 'controlla/core/SuspenseControlConsumer';
import ControlsConsumer from 'controlla/core/ControlsConsumer';
import useValue from 'controlla/core/useValue';
import selectLoading from 'controlla/core/selectLoading';
import selectError from 'controlla/core/selectError';
import invalidate from 'controlla/core/invalidate';
import usePrimitiveControl from 'controlla/core/usePrimitiveControl';
import setValue from 'controlla/core/setValue';
import getValue from 'controlla/core/getValue';
import NavLink from '#components/NavLink';
import type { Control } from 'controlla/core/types';
import type { FC } from 'react';

import { allListings, failNextDetailsRequest } from '#api';
import { listingRegistry } from '#controls/listings';
import { router } from '#router';

const IDS = allListings()
  .slice(0, 3)
  .map((listing) => listing.id);

const Skeleton: FC<{ width: string }> = ({ width }) => (
  <span className='skeleton' style={{ width }} />
);

/**
 * Suspending read. The fallback shows while the request is in flight; an error
 * goes to `renderIfError` instead of throwing to a boundary. This component has
 * its own Suspense boundary built in, so a slow listing never blanks the page.
 */
const DetailCard: FC<{ $selectedId: Control<number> }> = ({ $selectedId }) => {
  const id = useValue($selectedId);

  return (
    <SuspenseControlConsumer
      control={listingRegistry.get(id)}
      fallback={
        <div className='card'>
          <h2>
            <Skeleton width='18ch' />
          </h2>
          <p>
            <Skeleton width='34ch' />
          </p>
        </div>
      }
      renderIfError={(error: Error) => (
        <div className='card'>
          <p className='error'>{error.message}</p>
          <button onClick={() => invalidate(listingRegistry.get(id))}>
            Try again
          </button>
        </div>
      )}
      render={(listing) => (
        <div className='card'>
          <h2>{listing.title}</h2>
          <p style={{ color: 'var(--muted)', margin: '0 0 .6rem' }}>
            {listing.company} - {listing.location}
            {listing.remote ? ' - remote' : ''}
          </p>
          <p>{listing.summary}</p>
          <div className='row'>
            {listing.tags.map((tag) => (
              <span className='tag' key={tag}>
                {tag}
              </span>
            ))}
          </div>
          <p style={{ marginBottom: 0 }}>
            <NavLink to={router.navigation.listing({ id: listing.id })}>
              Open the full listing page
            </NavLink>
          </p>
        </div>
      )}
    />
  );
};

/**
 * Non-suspending read of the same control's status. `selectLoading` and
 * `selectError` are controls too, so this re-renders on status changes without
 * subscribing to the value.
 */
const StatusLine: FC<{ $selectedId: Control<number> }> = ({ $selectedId }) => {
  const id = useValue($selectedId);

  return (
    <ControlsConsumer
      controls={[
        selectLoading(listingRegistry.get(id)),
        selectError(listingRegistry.get(id)),
      ]}
      render={(isLoading, error) => (
        <p className='mono' style={{ color: 'var(--muted)' }}>
          listing {id}: {isLoading ? 'loading' : error ? 'error' : 'ready'}
        </p>
      )}
    />
  );
};

const Registry: FC = () => {
  /**
   * Which listing the detail card is showing - a control, but not a global one.
   * Nothing outside this page has any business reading it, so it is made here
   * and goes when the page does; module scope is for the registry above, which
   * really is one per app.
   */
  const $selectedId = usePrimitiveControl(IDS[0]);

  return (
    <>
      <h1>Async registry</h1>
      <p className='lede'>
        <code className='mono'>
          createRegistry(createAsyncControl, requestLoader(fetchListing))
        </code>{' '}
        - then just render <code className='mono'>registry.get(id)</code>.
      </p>

      <div className='card'>
        <h2>Pick a listing</h2>
        <div className='row'>
          {IDS.map((id) => (
            <button key={id} onClick={() => setValue($selectedId, id)}>
              {id}
            </button>
          ))}
        </div>
        <StatusLine $selectedId={$selectedId} />
      </div>

      <DetailCard $selectedId={$selectedId} />

      <div className='card'>
        <h2>Cache and refetch</h2>
        <p style={{ color: 'var(--muted)' }}>
          Switch listings and come back - the second visit is instant, because
          the control kept its value. These two buttons are the whole cache API.
        </p>
        <div className='row'>
          <button
            onClick={() =>
              invalidate(listingRegistry.get(getValue($selectedId)))
            }
          >
            invalidate (clear and refetch)
          </button>
          <button
            onClick={() =>
              invalidate(listingRegistry.get(getValue($selectedId)), true)
            }
          >
            invalidate silently (keep showing the old value)
          </button>
        </div>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Prefetching is the third one, and it does not belong on a page:{' '}
          <span className='mono'>src/preloads.ts</span> watches the route's
          params and <span className='mono'>retain</span>s what the next click
          will want, at module scope - so it has already started before React
          renders.
        </p>
      </div>

      <div className='card'>
        <h2>When it fails</h2>
        <p style={{ color: 'var(--muted)' }}>
          The stand-in API rejects the next detail request on demand, so you can
          see <code className='mono'>renderIfError</code> and the retry path for
          real.
        </p>
        <button
          onClick={() => {
            failNextDetailsRequest();

            invalidate(listingRegistry.get(getValue($selectedId)));
          }}
        >
          break the next request
        </button>
      </div>
    </>
  );
};

export default Registry;
