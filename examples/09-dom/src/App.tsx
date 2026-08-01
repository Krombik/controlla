/**
 * Browser state, already wrapped.
 *
 * These are the listeners you would otherwise write in an effect in every
 * component that cares: a media query, connectivity, tab visibility, window
 * size. As controls they are created once, shared by every reader, and
 * unsubscribe themselves - and they read the same way as anything else.
 *
 * `$online` is worth a second look: it is an *async* control, not a boolean, so
 * being offline reads as "not ready". That means the async tooling works on it -
 * a component can suspend while offline, and `toPromise($online)` is a promise
 * that resolves when the connection comes back.
 */

import mediaQuery from 'controlla/dom/mediaQuery';
import $online from 'controlla/dom/online';
import $pageVisible from 'controlla/dom/pageVisible';
import $windowSize from 'controlla/dom/windowSize';
import useValue from 'controlla/core/useValue';
import ControlConsumer from 'controlla/core/ControlConsumer';
import Suspense from 'controlla/core/Suspense';
import SuspenseControlConsumer from 'controlla/core/SuspenseControlConsumer';
import selectLoading from 'controlla/core/selectLoading';
import toPromise from 'controlla/core/toPromise';
import { useEffect, useState, type FC } from 'react';

/** Cached per query string, so calling it inline in a component is fine. */
const $isNarrow = mediaQuery('(max-width: 700px)');

const $prefersDark = mediaQuery('(prefers-color-scheme: dark)');

const $reducedMotion = mediaQuery('(prefers-reduced-motion: reduce)');

const Layout: FC = () => {
  // no resize listener, no state, no effect
  const isNarrow = useValue($isNarrow);

  return (
    <p style={{ margin: 0 }}>
      Rendering the <strong>{isNarrow ? 'narrow' : 'wide'}</strong> layout.{' '}
      <span className='muted'>Resize the window across 700px.</span>
    </p>
  );
};

const Queries: FC = () => (
  <ul className='muted' style={{ margin: 0 }}>
    <li>
      max-width 700px: <ControlConsumer control={$isNarrow} render={String} />
    </li>
    <li>
      prefers dark: <ControlConsumer control={$prefersDark} render={String} />
    </li>
    <li>
      reduced motion:{' '}
      <ControlConsumer control={$reducedMotion} render={String} />
    </li>
  </ul>
);

const Size: FC = () => {
  // width and height are separate controls - subscribe to one without
  // re-rendering on the other
  const width = useValue($windowSize.width);

  return (
    <p style={{ margin: 0 }}>
      width: {width}{' '}
      <span className='muted'>
        (this line does not re-render when only the height changes)
      </span>
    </p>
  );
};

/** Suspends while offline, because an offline `$online` has no value yet. */
const OnlineGate: FC = () => (
  <SuspenseControlConsumer
    control={$online}
    fallback={<p style={{ margin: 0, color: '#b3261e' }}>Offline - waiting…</p>}
    render={() => <p style={{ margin: 0 }}>Online.</p>}
  />
);

const App: FC = () => {
  const [reconnects, setReconnects] = useState(0);

  /** Re-arms after each reconnection, so it counts them rather than just the first. */
  useEffect(() => {
    let cancelled = false;

    const wait = () => {
      toPromise($online).then(() => {
        if (!cancelled) {
          setReconnects((n) => n + 1);
        }
      });
    };

    wait();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <h1>DOM controls</h1>
      <p className='lede'>
        Media queries, connectivity, visibility and window size - as controls
        rather than effects.
      </p>

      <fieldset>
        <legend>mediaQuery</legend>
        <Layout />
        <Queries />
      </fieldset>

      <fieldset>
        <legend>$windowSize</legend>
        <Size />
        <p className='muted' style={{ marginBottom: 0 }}>
          Committed once per animation frame while you drag, not once per event.
        </p>
      </fieldset>

      <fieldset>
        <legend>$pageVisible</legend>
        <p style={{ margin: 0 }}>
          visible: <ControlConsumer control={$pageVisible} render={String} />{' '}
          <span className='muted'>
            switch to another tab and come back - it updates while hidden
          </span>
        </p>
      </fieldset>

      <fieldset>
        <legend>$online, as an async control</legend>
        <Suspense fallback={null}>
          <OnlineGate />
        </Suspense>
        <p className='muted' style={{ margin: '.4rem 0 0' }}>
          loading (= offline):{' '}
          <ControlConsumer control={selectLoading($online)} render={String} /> ·
          resolved {reconnects} time(s)
        </p>
        <p className='muted' style={{ marginBottom: 0 }}>
          Tick "Offline" in devtools &gt; Network to see the fallback take over.
        </p>
      </fieldset>
    </>
  );
};

export default App;
