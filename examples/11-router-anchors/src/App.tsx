/**
 * Anchors: the section you are reading, in the URL.
 *
 * `anchor()` gives a route a hash-backed control. The two directions are not
 * symmetric, and the difference is deliberate:
 *
 * - **Writing the control** (the nav buttons) scrolls to the section *and* puts
 *   it in the hash, so the position is shareable and survives a reload.
 * - **Scrolling by hand** only marks the section on screen as `'active'` in
 *   `selectRegisteredAnchors`. `trackScroll` never touches the anchor control or
 *   the URL - otherwise the address bar would churn through five entries every
 *   time someone scrolled the page.
 *
 * The sections are deliberately tall, because a scroll spy needs a page that
 * actually scrolls. Try all four: click the nav, scroll by hand, reload on a
 * hash, and unmount a section to watch the nav lose its entry.
 */

import createRouter from 'controlla/router/createRouter';
import createPath from 'controlla/router/createPath';
import createRouterView from 'controlla/router/createRouterView';
import anchor from 'controlla/router/anchor';
import trackScroll from 'controlla/router/trackScroll';
import registerAnchor from 'controlla/router/registerAnchor';
import registerAnchorOffset from 'controlla/router/registerAnchorOffset';
import selectAnchor from 'controlla/router/selectAnchor';
import selectRegisteredAnchors from 'controlla/router/selectRegisteredAnchors';
import replaceValue from 'controlla/router/replaceValue';
import setValue from 'controlla/core/setValue';
import useValue from 'controlla/core/useValue';
import createPrimitiveControl from 'controlla/core/createPrimitiveControl';
import ControlConsumer from 'controlla/core/ControlConsumer';
import type { FC, PropsWithChildren } from 'react';

type SectionId =
  | 'overview'
  | 'installation'
  | 'configuration'
  | 'deployment'
  | 'troubleshooting';

const SECTIONS: Array<{ id: SectionId; title: string; body: string }> = [
  {
    id: 'overview',
    title: 'Overview',
    body: 'What the service does, who calls it, and which team is paged when it stops.',
  },
  {
    id: 'installation',
    title: 'Installation',
    body: 'Pull the chart, set the three required values, and apply it to the staging namespace first.',
  },
  {
    id: 'configuration',
    title: 'Configuration',
    body: 'Every setting has a default that works. The ones you will actually change are the connection pool size and the retry budget.',
  },
  {
    id: 'deployment',
    title: 'Deployment',
    body: 'Rollouts are blue/green. A failed health check for 90 seconds rolls back automatically.',
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    body: 'Start with the request log, then the pool metrics. Nine times out of ten it is the pool.',
  },
];

const router = createRouter({
  docs: createPath(
    /**
     * `trackScroll` wraps the anchor and adds the scroll spy. Without it the
     * anchor still works for jumping - you just do not get `'active'`.
     *
     * The resolver receives the offset element registered below, so the scroll
     * lands under the sticky header instead of behind it.
     */
    trackScroll(
      anchor<SectionId>((header) => ({
        behavior: 'smooth',
        topOffset: (header ? header.offsetHeight : 0) + 16,
      }))
    )
  ),
});

const $anchor = selectAnchor(router.routes.docs);

/** `true` per mounted id, `'active'` for the one on screen, `undefined` if absent. */
const $registered = selectRegisteredAnchors(router.routes.docs);

/** Lets the last section unmount, so the nav visibly loses an entry. */
const $showTroubleshooting = createPrimitiveControl(true);

const Nav: FC = () => (
  <nav
    // a bare ref, unlike registerAnchor's spreadable {id, ref}
    ref={registerAnchorOffset(router.routes.docs)}
    style={{
      position: 'sticky',
      top: 0,
      display: 'flex',
      gap: '.75rem',
      flexWrap: 'wrap',
      padding: '.75rem 0',
      background: 'Canvas',
      borderBottom: '1px solid #8886',
      zIndex: 1,
      height: 50,
    }}
  >
    {SECTIONS.map(({ id, title }) => (
      <ControlConsumer
        key={id}
        control={$registered[id]}
        render={(state) =>
          state && (
            <button
              key={id}
              onClick={() => replaceValue($anchor, id)}
              style={{
                borderColor: state === 'active' ? 'currentColor' : '#8886',
                fontWeight: state === 'active' ? 600 : 400,
              }}
            >
              {title}
            </button>
          )
        }
      />
    ))}
  </nav>
);

const Section: FC<PropsWithChildren<{ id: SectionId; title: string }>> = ({
  id,
  title,
  children,
}) => (
  <section
    // this is the whole integration: it makes the element the scroll target for
    // `id`, and puts `id` into selectRegisteredAnchors
    {...registerAnchor(router.routes.docs, id)}
    style={{ minHeight: '85vh', paddingTop: '1rem' }}
  >
    <h2>{title}</h2>
    <p>{children}</p>
    <p className='muted'>
      Keep scrolling - the nav above follows whichever section is on screen. The
      hash stays where you last put it.
    </p>
  </section>
);

const Docs: FC = () => {
  const showTroubleshooting = useValue($showTroubleshooting);

  return (
    <>
      <h1>Anchors</h1>
      <p className='lede'>
        The hash is a control. Clicking the nav writes it; scrolling only moves
        the highlight - watch the address bar to see the difference.
      </p>

      <Nav />

      <p className='muted'>
        current anchor:{' '}
        <code>
          <ControlConsumer
            control={$anchor}
            render={(id) => <>{id ?? '(none)'}</>}
          />
        </code>
      </p>

      <div className='row'>
        <button onClick={() => replaceValue($anchor, 'deployment')}>
          jump to deployment
        </button>
        <button onClick={() => replaceValue($anchor, '')}>
          clear the hash without scrolling
        </button>
        <button
          onClick={() => setValue($showTroubleshooting, (shown) => !shown)}
        >
          {showTroubleshooting ? 'unmount' : 'mount'} the first section
        </button>
      </div>

      {SECTIONS.filter(
        ({ id }) => id !== 'overview' || showTroubleshooting
      ).map(({ id, title, body }) => (
        <Section key={id} id={id} title={title}>
          {body}
        </Section>
      ))}

      <p className='muted' style={{ paddingBottom: '50vh' }}>
        Reload the page on a hash and it scrolls back here - and if the target
        is not mounted yet, the scroll retries the moment it is, unless you have
        scrolled in the meantime.
      </p>
    </>
  );
};

const App = createRouterView([[router.routes.docs, Docs]]);

export default App;
