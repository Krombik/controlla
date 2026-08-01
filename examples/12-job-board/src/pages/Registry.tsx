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
import retain from 'controlla/core/retain';
import createPrimitiveControl from 'controlla/core/createPrimitiveControl';
import setValue from 'controlla/core/setValue';
import getValue from 'controlla/core/getValue';
import NavLink from '#components/NavLink';
import { useEffect, useState, type FC } from 'react';

import { allListings, failNextDetailsRequest } from '#api';
import { listingRegistry } from '#controls/listings';
import { router } from '#router';

const IDS = allListings()
  .slice(0, 3)
  .map((listing) => listing.id);

/** Which listing the detail card below is showing. A plain local control. */
const $selectedId = createPrimitiveControl(IDS[0]);

const Skeleton: FC<{ width: string }> = ({ width }) => (
  <span className='skeleton' style={{ width }} />
);

/**
 * Suspending read. The fallback shows while the request is in flight; an error
 * goes to `renderIfError` instead of throwing to a boundary. This component has
 * its own Suspense boundary built in, so a slow listing never blanks the page.
 */
const DetailCard: FC = () => {
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
const StatusLine: FC = () => {
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

/**
 * Prefetching: `retain` starts a control's load without reading its value and
 * returns the release. While held, the control stays in use - so polling and
 * revalidation keep running even with nothing on screen.
 */
const Prefetch: FC = () => {
  useEffect(() => {
    const releases = IDS.map((id) => retain(listingRegistry.get(id)));

    return () => releases.forEach((release) => release());
  }, []);

  return <p style={{ color: 'var(--muted)' }}>Holding all three listings.</p>;
};

const Registry: FC = () => {
  const [prefetched, setPrefetched] = useState(false);

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
        <StatusLine />
      </div>

      <DetailCard />

      <div className='card'>
        <h2>Cache, refetch, prefetch</h2>
        <p style={{ color: 'var(--muted)' }}>
          Switch listings and come back - the second visit is instant, because
          the control kept its value. These three buttons are the whole cache
          API.
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
          <button disabled={prefetched} onClick={() => setPrefetched(true)}>
            prefetch the rest
          </button>
        </div>
        {prefetched && <Prefetch />}
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
