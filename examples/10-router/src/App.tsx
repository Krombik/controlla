/**
 * The router: URL as state, plus the pieces around it.
 *
 * Read `src/router.ts` first - it declares the whole URL surface. This file only
 * consumes it: `selectParams(route)` gives a control per param, so a filter is
 * read and written like any other value and the address bar follows on its own.
 * There is no `useSearchParams`, no parsing, no effect syncing state to the URL.
 *
 * `createRouterView` maps routes to pages and swaps only the slot that changed -
 * moving between the two invoice tabs never re-renders the layout around them.
 */

import createRouterView from 'controlla/router/createRouterView';
import Link from 'controlla/router/Link';
import navigate from 'controlla/router/navigate';
import selectParams from 'controlla/router/selectParams';
import replaceValue from 'controlla/router/replaceValue';
import NOT_FOUND from 'controlla/router/NOT_FOUND';
import useValue from 'controlla/core/useValue';
import ControlConsumer from 'controlla/core/ControlConsumer';
import type { NavigationTarget } from 'controlla/router/types';
import {
  useEffect,
  useState,
  type FC,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

import { router, type InvoiceStatus } from './router';

const NUMBERS = ['2024-0031', '2024-0032', '2024-0033'];

/** `Link` is headless: it hands you href/onClick/isMatched and you render the tag. */
const NavLink: FC<{
  to: NavigationTarget;
  children: ReactNode;
  exact?: true;
}> = ({ to, children, exact }) => (
  <Link
    to={to}
    trackMatch={exact ? 'exact' : true}
    render={({ href, onClick, isMatched }) => (
      <a
        href={href}
        onClick={onClick}
        style={{ fontWeight: isMatched ? 600 : 400 }}
      >
        {children}
      </a>
    )}
  />
);

const $filters = selectParams(router.routes.invoices);

const STATUSES: InvoiceStatus[] = ['all', 'open', 'paid', 'overdue'];

const Invoices: FC = () => {
  const status = useValue($filters.status);

  const page = useValue($filters.page);

  return (
    <>
      <h2>Invoices</h2>
      <p className='muted'>
        Both filters live in the URL. Change them, then use the back button.
      </p>

      <div className='row'>
        <label>
          <span className='muted'>status</span>
          <br />
          <select
            value={status}
            onChange={(e) => {
              // one write per control; both land in the same commit and produce
              // a single history entry
              replaceValue($filters.status, e.target.value as InvoiceStatus);

              replaceValue($filters.page, 1);
            }}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <span className='row'>
          <button
            disabled={page === 1}
            onClick={() => replaceValue($filters.page, (n) => n - 1)}
          >
            previous
          </button>
          <span>page {page}</span>
          <button onClick={() => replaceValue($filters.page, (n) => n + 1)}>
            next
          </button>
        </span>
      </div>

      <p className='muted'>
        <code>replaceValue</code> instead of <code>setValue</code> keeps paging
        out of the back button - only the status change pushes an entry.
      </p>

      <ul>
        {NUMBERS.map((number) => (
          <li key={number}>
            <NavLink to={router.navigation.invoice({ number }).lines()}>
              {number}
            </NavLink>
          </li>
        ))}
      </ul>
    </>
  );
};

const $invoice = selectParams(router.routes.invoice);

/** The parent route of the two tabs below - its param is shared with them. */
const InvoiceLayout: FC<PropsWithChildren> = ({ children }) => (
  <>
    <h2>
      Invoice <ControlConsumer control={$invoice.number} />
    </h2>
    <nav className='row'>
      <NavLink to={router.navigation.invoice().lines()} exact>
        lines
      </NavLink>
      <NavLink to={router.navigation.invoice().history({ view: 'timeline' })}>
        history
      </NavLink>
      <NavLink to={router.navigation.invoices({})}>back to the list</NavLink>
    </nav>
    <p className='muted'>
      The links above call <code>navigation.invoice()</code> with no arguments -
      the number is already in the URL, so it stays as it is.
    </p>
    {children}
  </>
);

const Lines: FC = () => (
  <fieldset>
    <legend>Lines</legend>
    <p style={{ margin: 0 }}>Consulting, 12 days. Hosting, 1 month.</p>
  </fieldset>
);

const $historyView = selectParams(router.routes.invoice.history).view;

const History: FC = () => {
  const view = useValue($historyView);

  return (
    <fieldset>
      <legend>History</legend>
      <div className='row'>
        {(['timeline', 'audit'] as const).map((value) => (
          <button
            key={value}
            disabled={value === view}
            onClick={() =>
              navigate(router.navigation.invoice().history({ view: value }))
            }
          >
            {value}
          </button>
        ))}
      </div>
      <p style={{ marginBottom: 0 }}>
        Showing the <strong>{view}</strong> view.{' '}
        <span className='muted'>
          A <code>oneOf</code> segment, so it can only ever be one of the two.
        </span>
      </p>
    </fieldset>
  );
};

/**
 * Blocking navigation. While the blocker is enabled, an attempted navigation -
 * a link, `navigate`, or the back button - is parked instead of applied, and
 * `isPendingNavigation` flips to true so you can ask. `allow()` lets the original
 * navigation continue; `deny()` drops it.
 */
const NewInvoice: FC = () => {
  const [dirty, setDirty] = useState(false);

  const pending = useValue(router.navigationBlocker.isPendingNavigation);

  useEffect(() => {
    if (dirty) {
      // returns its own disable, so this is the whole cleanup
      return router.navigationBlocker.enable();
    }
  }, [dirty]);

  return (
    <>
      <h2>New invoice</h2>
      <label>
        <span className='muted'>Reference</span>
        <br />
        <input
          placeholder='type something, then try to leave'
          onChange={() => setDirty(true)}
        />
      </label>

      <p className='muted'>
        {dirty
          ? 'Unsaved - navigation is blocked, including the back button and closing the tab.'
          : 'Type something to arm the blocker.'}
      </p>

      {pending && (
        <fieldset>
          <legend>Leave without saving?</legend>
          <div className='row'>
            <button
              onClick={() => {
                setDirty(false);

                router.navigationBlocker.isPendingNavigation.allow();
              }}
            >
              discard and leave
            </button>
            <button
              onClick={() =>
                router.navigationBlocker.isPendingNavigation.deny()
              }
            >
              stay here
            </button>
          </div>
        </fieldset>
      )}

      <NavLink to={router.navigation.invoices({})}>try to leave</NavLink>
    </>
  );
};

const Home: FC = () => (
  <>
    <h2>Home</h2>
    <ul>
      <li>
        <NavLink to={router.navigation.invoices({})}>invoices</NavLink> -
        filters in the query string
      </li>
      <li>
        <NavLink to={router.navigation.invoice({ number: NUMBERS[0] }).lines()}>
          one invoice
        </NavLink>{' '}
        - a path param and nested tabs
      </li>
      <li>
        <NavLink to={router.navigation.newInvoice()}>new invoice</NavLink> -
        blocking navigation
      </li>
      <li>
        <a href='/nope'>/nope</a> - the catch-all route
      </li>
    </ul>
  </>
);

const NotFound: FC = () => (
  <>
    <h2>No such page</h2>
    <NavLink to={router.navigation.home()}>go home</NavLink>
  </>
);

const Shell: FC<PropsWithChildren> = ({ children }) => (
  <>
    <h1>Router</h1>
    <p className='lede'>
      <NavLink to={router.navigation.home()}>home</NavLink> - the URL is the
      state; reload or share any of these.
    </p>
    {children}
  </>
);

const App = createRouterView([
  [
    Shell,
    [
      [router.routes.home, Home],
      [router.routes.invoices, Invoices],
      [router.routes.newInvoice, NewInvoice],
      [
        InvoiceLayout,
        [
          [router.routes.invoice.lines, Lines],
          [router.routes.invoice.history, History],
        ],
      ],
      [router.routes[NOT_FOUND], NotFound],
    ],
  ],
]);

export default App;
