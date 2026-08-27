/**
 * Three lifetimes for a control, and how to pick one.
 *
 * **Module scope** is for what is genuinely one per app: the registry below is
 * the cache, so a `retain` can warm it before anything renders, and two panels
 * showing the same sensor share its request. DOM controls and the router's params
 * are the same kind of thing. Almost nothing else qualifies - a control at module
 * scope is one value for every visitor, which on a server means one value for
 * every request at once.
 *
 * **A bag** - `createControlsContext` - is the default for everything else. It
 * builds its controls once per mounted provider, so the two panels below own
 * separate copies of the same declarations, neither knows the other exists, and a
 * server hands each request its own. `createControls` runs once, inside a branch,
 * so it is the `create*` calls that go in there, never the `use*` hooks.
 *
 * **`useControl`** is for what one component owns and nobody asks it about.
 *
 * Nothing about *reading* changes between them: `useValue`, `ControlConsumer`,
 * `setValue` and the async tooling work the same on all three. Where a control is
 * declared decides who can see it and how long it lives - not how it is used,
 * which is why the same `<Reading />` renders under either panel with no props.
 */

import createRegistry from 'controlla/core/createRegistry';
import createAsyncControl from 'controlla/core/createAsyncControl';
import createBoundControl from 'controlla/core/createBoundControl';
import createControlsContext from 'controlla/core/createControlsContext';
import createControl from 'controlla/core/createControl';
import createDerivedControl from 'controlla/core/createDerivedControl';
import createPrimitiveControl from 'controlla/core/createPrimitiveControl';
import useControl from 'controlla/core/useControl';
import useValue from 'controlla/core/useValue';
import setValue from 'controlla/core/setValue';
import invalidate from 'controlla/core/invalidate';
import requestLoader from 'controlla/loader/requestLoader';
import ControlConsumer from 'controlla/core/ControlConsumer';
import CombinedControlsConsumer from 'controlla/core/CombinedControlsConsumer';
import SuspenseControlConsumer from 'controlla/core/SuspenseControlConsumer';
import type { FC, PropsWithChildren } from 'react';

type Reading = { sensor: string; celsius: number; samples: number[] };

const SENSORS = ['inlet-04', 'outlet-11', 'ambient-02', 'coolant-07'];

const fetchReading = async (sensor: string): Promise<Reading> => {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const seed = sensor.charCodeAt(sensor.length - 1);

  return {
    sensor,
    celsius: 18 + (seed % 12),
    samples: Array.from({ length: 6 }, (_, i) => 18 + ((seed + i * 3) % 12)),
  };
};

/**
 * Module level: one control per sensor for the whole tab, so two panels showing
 * the same sensor share the request and the cache. This is the part you do *not*
 * want per provider.
 */
const readingRegistry = createRegistry(
  createAsyncControl,
  requestLoader(fetchReading),
  { keepPrev: true }
);

/**
 * One bag around the whole screen: the unit every panel reads, and which panels
 * are open. Not module-level, because neither is a property of the app - they are
 * a property of this screen, and a second copy of the screen wants its own.
 */
const [ScreenProvider, useScreen] = createControlsContext(() => ({
  $unit: createPrimitiveControl<'C' | 'F'>('C'),
  $openPanels: createControl(['A', 'B']),
}));

/**
 * The bag. `createControls` runs once per mounted provider and its result is the
 * context value for good, so the identity of these controls never changes and
 * `createBoundControl` can be called here rather than in a component.
 */
const [PanelProvider, usePanel] = createControlsContext(() => {
  const $sensor = createPrimitiveControl(SENSORS[0]);

  return {
    $sensor,
    /**
     * Follows this panel's `$sensor` and nothing else. In a component this would
     * be `useBoundControl`; in a bag it is the plain call, because the bag's
     * lifetime is already the provider's.
     */
    $reading: createBoundControl(readingRegistry, $sensor),
  };
});

/**
 * A second bag built on the first: pass a hook as the second argument and its
 * result reaches `createControls`. It runs on every render while `createControls`
 * runs once, so this bag keeps the panel it was first mounted under.
 */
const [TrendProvider, useTrend] = createControlsContext(
  ({ $reading }: ReturnType<typeof usePanel>) => ({
    $trend: createDerivedControl($reading.samples, (samples) =>
      samples
        ? samples[samples.length - 1] - samples[0] > 0
          ? 'rising'
          : 'falling'
        : 'no data'
    ),
  }),
  usePanel
);

const SensorPicker: FC = () => {
  const { $sensor } = usePanel();

  const sensor = useValue($sensor);

  return (
    <div className='row'>
      {SENSORS.map((name) => (
        <button
          key={name}
          disabled={name === sensor}
          onClick={() => setValue($sensor, name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
};

/** No props, no context of its own - it asks the nearest panel for its data. */
const Reading: FC = () => {
  const { $reading } = usePanel();

  const { $unit } = useScreen();

  return (
    <SuspenseControlConsumer
      control={$reading}
      fallback={<p className='muted'>Reading…</p>}
      render={(reading) => (
        // both the reading and the unit are passed in: a combiner is captured
        // when the derived control is built, so one that closed over `reading`
        // would go on formatting the sensor this panel showed first
        <CombinedControlsConsumer
          controls={[$reading.celsius, $unit]}
          combiner={(celsius, unit) =>
            celsius === undefined
              ? '…'
              : unit === 'C'
                ? `${celsius.toFixed(1)} °C`
                : `${(celsius * 1.8 + 32).toFixed(1)} °F`
          }
          render={(temperature) => (
            <p style={{ margin: 0, fontSize: '1.6rem' }}>
              {temperature}{' '}
              <span className='muted' style={{ fontSize: '.85rem' }}>
                {reading.sensor}
              </span>
            </p>
          )}
        />
      )}
    />
  );
};

const Trend: FC = () => (
  <p className='muted' style={{ margin: '.3rem 0 0' }}>
    trend: {useValue(useTrend().$trend)}
  </p>
);

/**
 * A control that belongs to this component and nothing else: `useControl` makes
 * it on the first render, keeps it for the component's life, and lets it go on
 * unmount. Collapse the panel and the note is gone - which is the right lifetime
 * for a draft nobody else reads.
 */
const Note: FC = () => {
  const $note = useControl({ text: '', pinned: false });

  return (
    <>
      <label>
        <span className='muted'>Note (lives as long as this component)</span>
        <br />
        <input
          style={{ width: '100%' }}
          value={useValue($note.text)}
          onChange={(e) => setValue($note.text, e.target.value)}
        />
      </label>
      <label className='row' style={{ marginTop: '.4rem' }}>
        <input
          type='checkbox'
          checked={useValue($note.pinned)}
          onChange={(e) => setValue($note.pinned, e.target.checked)}
        />
        <span>pin it</span>
      </label>
    </>
  );
};

const Panel: FC<PropsWithChildren<{ name: string }>> = ({ name, children }) => (
  <PanelProvider>
    <fieldset>
      <legend>Panel {name}</legend>
      <SensorPicker />
      <div style={{ marginTop: '.6rem' }}>
        <Reading />
        <TrendProvider>
          <Trend />
        </TrendProvider>
      </div>
      <div style={{ marginTop: '.6rem' }}>
        <Note />
      </div>
      {children}
    </fieldset>
  </PanelProvider>
);

const Shared: FC = () => {
  const { $unit } = useScreen();

  return (
    <fieldset>
      <legend>Shared by every panel</legend>
      <ControlConsumer
        control={$unit}
        render={(unit) => (
          <div className='row'>
            <button
              disabled={unit === 'C'}
              onClick={() => setValue($unit, 'C')}
            >
              celsius
            </button>
            <button
              disabled={unit === 'F'}
              onClick={() => setValue($unit, 'F')}
            >
              fahrenheit
            </button>
            <button
              // module level, so this reaches every panel showing that sensor
              onClick={() => invalidate(readingRegistry.get(SENSORS[0]))}
            >
              refetch {SENSORS[0]}
            </button>
          </div>
        )}
      />
      <p className='muted' style={{ marginBottom: 0 }}>
        Point both panels at the same sensor: one request, one cached value, two
        readers. Point them at different ones and they are independent.
      </p>
    </fieldset>
  );
};

const Panels: FC = () => {
  const { $openPanels } = useScreen();

  return (
    <>
      <ControlConsumer
        control={$openPanels}
        render={(panels) =>
          panels.map((name) => (
            <Panel key={name} name={name}>
              <div className='row' style={{ marginTop: '.6rem' }}>
                <button
                  onClick={() =>
                    setValue($openPanels, (open) =>
                      open.filter((other) => other !== name)
                    )
                  }
                >
                  close this panel
                </button>
              </div>
            </Panel>
          ))
        }
      />

      <ControlConsumer
        control={$openPanels.length}
        render={(count) =>
          count < 2 && (
            <button onClick={() => setValue($openPanels, ['A', 'B'])}>
              reopen the closed panel - its bag is built again from scratch,
              while the one still mounted keeps everything it had
            </button>
          )
        }
      />
    </>
  );
};

const App: FC = () => (
  <ScreenProvider>
    <h1>Controls context</h1>
    <p className='lede'>
      Two panels, one set of declarations, no shared state - and one registry
      underneath both.
    </p>

    <Shared />
    <Panels />
  </ScreenProvider>
);

export default App;
