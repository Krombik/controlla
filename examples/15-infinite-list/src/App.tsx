/**
 * A list whose length is not known while you are writing the component.
 *
 * `useValue` and `useSuspenseValues` both need a fixed number of controls -
 * hooks cannot be called conditionally, and an array that grows between renders
 * is the same problem. `useInfiniteValues` is the one that takes a list whose
 * length changes: page 4 appearing does not break the subscriptions of pages 0
 * to 3.
 *
 * `useBoundControl` is its other half. It keeps one bound control per call
 * position, so a list calls it once per row, a row rebuilds only when the keys
 * it was called with change, and a position that a render stops reaching lets go
 * of its item.
 *
 * `InfiniteControlsConsumer` is the same hook as a component, for a list sitting
 * inline in something bigger that should not re-render with it.
 */

import createRegistry from 'controlla/core/createRegistry';
import createAsyncControl from 'controlla/core/createAsyncControl';
import createControl from 'controlla/core/createControl';
import createControlsContext from 'controlla/core/createControlsContext';
import createPrimitiveControl from 'controlla/core/createPrimitiveControl';
import useBoundControl from 'controlla/core/useBoundControl';
import useInfiniteValues from 'controlla/core/useInfiniteValues';
import useValue from 'controlla/core/useValue';
import setValue from 'controlla/core/setValue';
import requestLoader from 'controlla/loader/requestLoader';
import type { FC } from 'react';

type Entry = { id: number; name: string; role: string };

type Page = { entries: Entry[]; hasMore: boolean };

const ROLES = ['maintainer', 'reviewer', 'triager', 'author'];

const PAGE_SIZE = 5;

const LAST_PAGE = 4;

/**
 * A plain counter, not a control: the fake API writes it, and the only component
 * showing it re-renders whenever a page arrives - which is exactly when it moves.
 */
let requests = 0;

const fetchPage = async (page: number): Promise<Page> => {
  requests++;

  // later pages are slower, so a page can arrive out of order and the row for
  // it sits as a skeleton while its neighbours are already there
  await new Promise((resolve) => setTimeout(resolve, 400 + page * 300));

  return {
    hasMore: page < LAST_PAGE,
    entries: Array.from({ length: PAGE_SIZE }, (_, i) => {
      const id = page * PAGE_SIZE + i;

      return { id, name: `contributor-${100 + id}`, role: ROLES[id % 4] };
    }),
  };
};

const pageRegistry = createRegistry(
  createAsyncControl,
  requestLoader(fetchPage)
);

const entryRegistry = createRegistry(
  createAsyncControl,
  requestLoader(async (id: number) => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    return { id, commits: 12 + ((id * 37) % 400) };
  })
);

/**
 * The registries are module-level - they are the cache, and a `retain` could warm
 * them before anything renders. How far the feed has been scrolled and which rows
 * are being watched are not that: they are this screen's, so they live in a bag,
 * built once per mounted provider and gone with it.
 */
const [FeedProvider, useFeed] = createControlsContext(() => ({
  /** How many pages the feed is asking for. Nothing else decides its length. */
  $pageCount: createPrimitiveControl(1),
  /** Which rows the strip at the bottom is watching - a list that shrinks too. */
  $watched: createControl<number[]>([]),
}));

const Row: FC<{ entry: Entry }> = ({ entry }) => {
  const { $watched } = useFeed();

  return (
    <li className='row'>
      <strong>{entry.name}</strong>
      <span className='muted'>{entry.role}</span>
      <button
        onClick={() =>
          setValue($watched, (ids) =>
            ids.includes(entry.id)
              ? ids.filter((id) => id !== entry.id)
              : [...ids, entry.id]
          )
        }
      >
        {useValue($watched).includes(entry.id) ? 'unwatch' : 'watch'}
      </button>
    </li>
  );
};

const Skeleton: FC<{ page: number }> = ({ page }) => (
  <li className='muted'>page {page + 1} still loading…</li>
);

/**
 * One `bind` for the component, one control per call position. Asking for a page
 * starts its request, and the pages that have not arrived yet come back as
 * `undefined` rather than suspending - so the rows already loaded stay on screen.
 */
const Feed: FC = () => {
  const { $pageCount } = useFeed();

  const pageCount = useValue($pageCount);

  const bind = useBoundControl(pageRegistry);

  const pages = useInfiniteValues(
    Array.from({ length: pageCount }, (_, page) => bind(page))
  );

  const last = pages[pages.length - 1];

  return (
    <>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {pages.map((page, index) =>
          page ? (
            page.entries.map((entry) => <Row key={entry.id} entry={entry} />)
          ) : (
            <Skeleton key={index} page={index} />
          )
        )}
      </ul>
      <div className='row'>
        <button
          disabled={!last || !last.hasMore}
          onClick={() => setValue($pageCount, (n) => n + 1)}
        >
          {last ? (last.hasMore ? 'load more' : 'that is all of them') : '…'}
        </button>
        <button
          disabled={pageCount === 1}
          onClick={() => setValue($pageCount, 1)}
        >
          back to one page
        </button>
        <span className='muted'>
          {pageCount} page(s) asked for, {requests} request(s) made
        </span>
      </div>
      <p className='muted' style={{ marginBottom: 0 }}>
        Collapse back to one page and load more again: the pages that were
        already fetched come straight from the registry, so the request count
        does not move.
      </p>
    </>
  );
};

/**
 * The same two hooks over a list that shrinks as well as grows: unwatch a row
 * and its position stops being reached, so the bound control lets go of its
 * item.
 */
const Watched: FC = () => {
  const ids = useValue(useFeed().$watched);

  const bind = useBoundControl(entryRegistry);

  const entries = useInfiniteValues(ids.map((id) => bind(id)));

  return ids.length ? (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {entries.map((entry, index) => (
        <li key={ids[index]}>
          contributor-{100 + ids[index]}:{' '}
          {entry ? (
            <strong>{entry.commits} commits</strong>
          ) : (
            <span className='muted'>counting…</span>
          )}
        </li>
      ))}
    </ul>
  ) : (
    <p className='muted' style={{ margin: 0 }}>
      Watch a row above and it appears here, with its own request.
    </p>
  );
};

const App: FC = () => (
  <FeedProvider>
    <h1>Infinite list</h1>
    <p className='lede'>
      A list of controls whose length changes between renders - which is the one
      thing the other read hooks cannot do.
    </p>

    <fieldset>
      <legend>Pages</legend>
      <Feed />
    </fieldset>

    <fieldset>
      <legend>Watching individual rows</legend>
      <Watched />
    </fieldset>
  </FeedProvider>
);

export default App;
