/**
 * A detail page assembled from independent sections.
 *
 * The page itself subscribes to almost nothing - it renders a nav, a title and
 * five sections, and each of those reads exactly the slice of data it shows.
 * Navigating to a different listing changes one param control and the whole page
 * re-points; nothing here re-runs a fetch by hand.
 *
 * `Suspense` here is the library's own, not React's - it is what the sections'
 * `SuspenseControlConsumer` boundaries and `useSuspenseValue` need above them.
 */

import Suspense from 'controlla/core/Suspense';
import useValue from 'controlla/core/useValue';
import SuspenseControlConsumer from 'controlla/core/SuspenseControlConsumer';
import mediaQuery from 'controlla/dom/mediaQuery';
import navigate from 'controlla/router/navigate';
import type { FC } from 'react';

import { allListings } from '#api';
import { router } from '#router';
import { $id, $listing } from '#pages/Listing/bound';
import SectionNav from '#pages/Listing/SectionNav';
import {
  Benefits,
  Company,
  Requirements,
  Responsibilities,
  Summary,
} from '#pages/Listing/sections';

/** Created once per query string and shared, so calling it inline is fine. */
const $isNarrow = mediaQuery('(max-width: 700px)');

const IDS = allListings()
  .slice(0, 4)
  .map((listing) => listing.id);

const Title: FC = () => (
  <SuspenseControlConsumer
    control={$listing}
    fallback={
      <h1>
        <span className='skeleton' style={{ width: '22ch' }} />
      </h1>
    }
    render={(listing) => (
      <>
        <h1>{listing.title}</h1>
        <p className='lede'>
          {listing.company} - {listing.location}
          {listing.remote ? ' - remote' : ''} - {listing.salaryFrom / 1000}k to{' '}
          {listing.salaryTo / 1000}k
        </p>
      </>
    )}
  />
);

const Listing: FC = () => {
  const id = useValue($id);

  // a plain boolean control - no resize listener, no state, no effect
  const isNarrow = useValue($isNarrow);

  return (
    <Suspense fallback={null}>
      <div className='row' style={{ marginBottom: '1rem' }}>
        <span style={{ color: 'var(--muted)' }}>Jump to a listing:</span>
        {IDS.map((otherId) => (
          <button
            key={otherId}
            disabled={otherId === id}
            onClick={() => navigate(router.navigation.listing({ id: otherId }))}
          >
            {otherId}
          </button>
        ))}
      </div>

      <Title />
      <SectionNav />

      <Summary />
      <Responsibilities />
      <Requirements />
      {/* the narrow layout drops a section entirely, which is also how you can
          watch `selectRegisteredAnchors` lose an entry: resize and the nav
          above stops offering Benefits */}
      {!isNarrow && <Benefits />}
      <Company />

      <p style={{ color: 'var(--muted)' }}>
        Clicking the section nav writes the hash; scrolling only moves the
        highlight. See <code className='mono'>11-router-anchors</code> for why
        those two differ.
      </p>
    </Suspense>
  );
};

export default Listing;
