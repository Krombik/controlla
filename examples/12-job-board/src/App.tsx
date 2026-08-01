/**
 * The shell. `createRouterView` maps each route to its page and swaps only the
 * slot that changed - switching examples never re-renders this nav.
 */

import createRouterView from 'controlla/router/createRouterView';
import NOT_FOUND from 'controlla/router/NOT_FOUND';
import type { FC, PropsWithChildren } from 'react';

import { router } from '#router';

import NavLink from '#components/NavLink';

import Home from '#pages/Home';
import FormState from '#pages/FormState';
import Registry from '#pages/Registry';
import Listing from '#pages/Listing';
import Search from '#pages/Search';
import Saved from '#pages/Saved';
import NotFound from '#pages/NotFound';

const EXAMPLES = [
  ['Local state', router.navigation.formState(), 'createControl, nested paths'],
  ['Async registry', router.navigation.registry(), 'one control per key'],
  [
    'Listing page',
    router.navigation.listing({ id: 1003 }),
    'sections, anchors',
  ],
  ['Search', router.navigation.search({}), 'url as state, polling'],
  ['Saved', router.navigation.saved({}), 'persistence, derived'],
] as const;

const Layout: FC<PropsWithChildren> = ({ children }) => (
  <div className='shell'>
    <nav>
      <p>
        <NavLink to={router.navigation.home()}>
          <strong>controlla examples</strong>
        </NavLink>
      </p>
      <ol>
        {EXAMPLES.map(([label, to, hint]) => (
          <li key={label}>
            <NavLink to={to} trackMatch>
              {label}
            </NavLink>
            <br />
            <small style={{ color: 'var(--muted)' }}>{hint}</small>
          </li>
        ))}
      </ol>
    </nav>
    <main>{children}</main>
  </div>
);

const App = createRouterView([
  [
    Layout,
    [
      [router.routes.home, Home],
      [router.routes.formState, FormState],
      [router.routes.registry, Registry],
      [router.routes.listing, Listing],
      [router.routes.search, Search],
      [router.routes.saved, Saved],
      [router.routes[NOT_FOUND], NotFound],
    ],
  ],
]);

export default App;
