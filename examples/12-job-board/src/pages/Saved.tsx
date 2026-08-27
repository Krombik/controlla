/**
 * Persistence and derivation.
 *
 * `$saved` is an ordinary control that happens to be backed by localStorage. It
 * is read and written like any other; the storage is a second argument, not an
 * API you call. Open this page in two tabs and save something - the other tab
 * updates, because the storage is observed.
 *
 * Everything else on the page is derived from it. The sort order comes from the
 * URL, so a sorted list is shareable, and the derived control recomputes only
 * when the saved set or the sort actually changes.
 */

import createControl from 'controlla/core/createControl';
import getPersistStorage from 'controlla/persist/getPersistStorage';
import safeLocalStorage from 'controlla/persist/safeLocalStorage';
import createDerivedControl from 'controlla/core/createDerivedControl';
import setValue from 'controlla/core/setValue';
import useValue from 'controlla/core/useValue';
import ControlConsumer from 'controlla/core/ControlConsumer';
import selectParams from 'controlla/router/selectParams';
import type { FC } from 'react';

import { allListings, type Listing } from '#api';
import { router } from '#router';
import NavLink from '#components/NavLink';

type SavedState = { ids: number[] };

/**
 * Module-level, and rightly so: a control backed by storage really is one per
 * browser - one key, shared by every tab - and the sort below it is the URL. A
 * control with no global source behind it belongs in a bag instead.
 *
 * `isValid` is the version guard: anything written by an older build that no
 * longer parses into this shape is discarded instead of crashing a reader.
 */
const $saved = createControl<SavedState>(
  { ids: [] },
  getPersistStorage({
    name: 'controlla.examples.saved',
    storage: safeLocalStorage,
    isValid: (value): value is SavedState =>
      !!value &&
      Array.isArray((value as SavedState).ids) &&
      (value as SavedState).ids.every((id) => typeof id === 'number'),
  })
);

const $sort = selectParams(router.routes.saved).sort;

const LISTINGS = allListings();

const byId = new Map(LISTINGS.map((listing) => [listing.id, listing]));

/**
 * Derived, so the sorting runs once per change rather than once per render, and
 * a component reading it re-renders only when the resulting list differs.
 */
const $savedListings = createDerivedControl(
  $saved.ids,
  $sort,
  (ids, sort): Listing[] => {
    const listings = ids
      .map((id) => byId.get(id))
      .filter((listing): listing is Listing => !!listing);

    return listings.sort((a, b) =>
      sort === 'salary'
        ? b.salaryTo - a.salaryTo
        : sort === 'title'
          ? a.title.localeCompare(b.title)
          : b.postedDaysAgo - a.postedDaysAgo
    );
  }
);

const toggle = (id: number) =>
  setValue($saved.ids, (ids) =>
    ids.includes(id) ? ids.filter((saved) => saved !== id) : [...ids, id]
  );

const SortPicker: FC = () => {
  const sort = useValue($sort);

  return (
    <label>
      <span>Sort</span>
      <select
        value={sort}
        onChange={(e) =>
          setValue($sort, e.target.value as 'recent' | 'salary' | 'title')
        }
      >
        <option value='recent'>most recently posted</option>
        <option value='salary'>highest salary</option>
        <option value='title'>title</option>
      </select>
    </label>
  );
};

const Row: FC<{ listing: Listing; saved: boolean }> = ({ listing, saved }) => (
  <li className='card' style={{ margin: '0 0 .5rem' }}>
    <div className='row' style={{ justifyContent: 'space-between' }}>
      <div>
        <NavLink to={router.navigation.listing({ id: listing.id })}>
          <strong>{listing.title}</strong>
        </NavLink>
        <div style={{ color: 'var(--muted)' }}>
          {listing.company} - {listing.salaryFrom / 1000}k to{' '}
          {listing.salaryTo / 1000}k - posted {listing.postedDaysAgo}d ago
        </div>
      </div>
      <button onClick={() => toggle(listing.id)}>
        {saved ? 'remove' : 'save'}
      </button>
    </div>
  </li>
);

const Saved: FC = () => (
  <>
    <h1>Saved</h1>
    <p className='lede'>
      Backed by localStorage and observed across tabs - open this page twice and
      save something in one of them.
    </p>

    <div className='card'>
      <SortPicker />
      {/* the count is its own subscriber, so it updates without re-rendering
            either list below */}
      <p style={{ margin: 0, color: 'var(--muted)' }}>
        <ControlConsumer
          control={$saved.ids.length}
          render={(count) => <>{count} saved</>}
        />
      </p>
    </div>

    <ControlConsumer
      control={$savedListings}
      render={(listings) =>
        listings.length ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {listings.map((listing) => (
              <Row key={listing.id} listing={listing} saved />
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--muted)' }}>
            Nothing saved yet - pick something below.
          </p>
        )
      }
    />

    <h2 style={{ margin: '1.5rem 0 .75rem' }}>All listings</h2>
    {/* the consumer is the only thing that re-renders when something is
          saved - the sorted list above has its own subscriber */}
    <ControlConsumer
      control={$saved.ids}
      render={(savedIds) => (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {LISTINGS.slice(0, 10).map((listing) => (
            <Row
              key={listing.id}
              listing={listing}
              saved={savedIds.includes(listing.id)}
            />
          ))}
        </ul>
      )}
    />
  </>
);

export default Saved;
