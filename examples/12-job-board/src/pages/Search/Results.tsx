/**
 * Results for the current query and page, polled until the backend says it is
 * finished. `$results` follows both - see `controls.ts`.
 *
 * Because the poll was declared with `syncedKeysCount: 1`, all pages of a single
 * query share one clock - so paging around during a search does not spawn a
 * second polling loop, and `pause`/`resume` act on the whole query at once.
 */

import setValue from 'controlla/core/setValue';
import getValue from 'controlla/core/getValue';
import useValue from 'controlla/core/useValue';
import selectLoading from 'controlla/core/selectLoading';
import watchValues from 'controlla/core/watchValues';
import SuspenseControlConsumer from 'controlla/core/SuspenseControlConsumer';
import $appVisible from 'controlla/platform/appVisible';
import { useEffect, type FC } from 'react';

import { PAGE_SIZE, resetSearchRounds } from '#api';
import { searchPolling } from '#controls/listings';
import { router } from '#router';
import NavLink from '#components/NavLink';
import { $params, $query, $results } from '#pages/Search/controls';

const Skeleton: FC<{ width: string }> = ({ width }) => (
  <span className='skeleton' style={{ width }} />
);

const Row: FC<{ children?: never }> = () => (
  <li className='card' style={{ margin: '0 0 .5rem' }}>
    <Skeleton width='26ch' />
    <br />
    <Skeleton width='18ch' />
  </li>
);

/**
 * While a poll is still widening the result set, say so instead of showing a
 * spinner over results the user can already read.
 */
const StillSearching: FC = () =>
  useValue(selectLoading($results)) ? (
    <span className='tag'>still gathering results…</span>
  ) : null;

const Pager: FC<{ total: number }> = ({ total }) => {
  const page = useValue($params.page);

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className='row'>
      <button
        disabled={page === 0}
        onClick={() => setValue($params.page, (n) => n - 1)}
      >
        previous
      </button>
      <span style={{ color: 'var(--muted)' }}>
        page {page + 1} of {lastPage + 1} - {total} matches
      </span>
      <button
        disabled={page >= lastPage}
        onClick={() => setValue($params.page, (n) => n + 1)}
      >
        next
      </button>
    </div>
  );
};

const Results: FC = () => {
  /**
   * Polling should stop while the tab is in the background. `pause`/`resume` take
   * the *group* keys - here just the query - so one call covers every page of the
   * current search, and the watcher's own cleanup resumes exactly what it paused.
   */
  useEffect(
    () =>
      watchValues([$query, $appVisible], ([query, isVisible]) => {
        if (!isVisible) {
          searchPolling.pause(query);

          return () => searchPolling.resume(query);
        }
      }),
    []
  );

  return (
    <>
      <div className='row' style={{ margin: '0 0 .75rem' }}>
        <StillSearching />
        <button
          onClick={() => {
            // let the stand-in backend hand out a partial set again, then make
            // the poll fetch now instead of waiting out its interval
            resetSearchRounds();

            searchPolling.reset(getValue($query));
          }}
        >
          search again from scratch
        </button>
      </div>

      <SuspenseControlConsumer
        control={$results}
        fallback={
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <Row key={i} />
            ))}
          </ul>
        }
        renderIfError={(error: Error) => (
          <p className='error'>{error.message}</p>
        )}
        render={(results) => (
          <>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {results.items.map((listing) => (
                <li
                  className='card'
                  key={listing.id}
                  style={{ margin: '0 0 .5rem' }}
                >
                  <NavLink to={router.navigation.listing({ id: listing.id })}>
                    <strong>{listing.title}</strong>
                  </NavLink>
                  <div style={{ color: 'var(--muted)' }}>
                    {listing.company} - {listing.location}
                    {listing.remote ? ' - remote' : ''}
                  </div>
                  <div className='row' style={{ marginTop: '.35rem' }}>
                    <span className='tag'>{listing.seniority}</span>
                    {listing.tags.map((tag) => (
                      <span className='tag' key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {results.items.length === 0 && (
              <p style={{ color: 'var(--muted)' }}>Nothing matched.</p>
            )}
            <Pager total={results.total} />
          </>
        )}
      />
    </>
  );
};

export default Results;
