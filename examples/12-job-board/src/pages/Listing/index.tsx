/**
 * A detail page assembled from independent sections.
 *
 * The page itself subscribes to almost nothing - it renders a nav, a title and
 * five sections, and each of those reads exactly the slice of data it shows.
 * Navigating to a different listing changes one param control and the whole page
 * re-points; nothing here re-runs a fetch by hand.
 *
 * `ListingProvider` is what scopes the page's controls to the page: see
 * `controls.ts`. There is no `Suspense` boundary anywhere in here, because every
 * `SuspenseControlConsumer` is one.
 */

import SuspenseControlConsumer from 'controlla/core/SuspenseControlConsumer';
import useValue from 'controlla/core/useValue';
import mediaQuery from 'controlla/dom/mediaQuery';
import navigate from 'controlla/router/navigate';
import type { FC, PropsWithChildren } from 'react';

import { JUMP_IDS } from '#controls/listings';
import { router } from '#router';
import { ListingProvider, useListing } from '#pages/Listing/controls';
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

const Title: FC = () => (
  <SuspenseControlConsumer
    control={useListing().$listing}
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

const JumpTo: FC = () => {
  const id = useValue(useListing().$id);

  return (
    <div className='row' style={{ marginBottom: '1rem' }}>
      {/* `src/preloads.ts` has already started loading these */}
      <span style={{ color: 'var(--muted)' }}>Jump to a listing:</span>
      {JUMP_IDS.map((otherId) => (
        <button
          key={otherId}
          disabled={otherId === id}
          onClick={() => navigate(router.navigation.listing({ id: otherId }))}
        >
          {otherId}
        </button>
      ))}
    </div>
  );
};

/** Its own component, so a resize re-renders this and not the page. */
const WideOnly: FC<PropsWithChildren> = ({ children }) =>
  useValue($isNarrow) ? null : children;

const Listing: FC = () => (
  <ListingProvider>
    <JumpTo />

    <Title />
    <SectionNav />

    <Summary />
    <Responsibilities />
    <Requirements />
    {/* the narrow layout drops a section entirely, which is also how you can
        watch `selectRegisteredAnchors` lose an entry: resize and the nav above
        stops offering Benefits. A plain boolean control - no resize listener,
        no state, no effect */}
    <WideOnly>
      <Benefits />
    </WideOnly>
    <Company />

    <p style={{ color: 'var(--muted)' }}>
      Clicking the section nav writes the hash; scrolling only moves the
      highlight. See <code className='mono'>11-router-anchors</code> for why
      those two differ.
    </p>
  </ListingProvider>
);

export default Listing;
