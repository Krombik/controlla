/**
 * Data that is not finished when the first response arrives.
 *
 * A CI job you have just triggered is the obvious case: the endpoint answers
 * immediately, but with `status: 'running'`. `pollLoader` keeps asking until
 * `isLoaded` says otherwise, then stops on its own - no interval to clear, no
 * "is it done yet" flag in a component.
 *
 * `syncedKeysCount: 1` is the interesting option. The registry is keyed by
 * (pipeline, stage), and this puts every stage of one pipeline on a single shared
 * clock: they refetch together instead of drifting into separate loops, and
 * `pause`/`resume`/`reset` act on the whole pipeline at once.
 */

import createRegistry from 'controlla/core/createRegistry';
import createAsyncControl from 'controlla/core/createAsyncControl';
import pollLoader from 'controlla/loader/pollLoader';
import Suspense from 'controlla/core/Suspense';
import SuspenseControlConsumer from 'controlla/core/SuspenseControlConsumer';
import ControlConsumer from 'controlla/core/ControlConsumer';
import selectLoading from 'controlla/core/selectLoading';
import { useEffect, useState, type FC } from 'react';

type StageState = {
  stage: string;
  status: 'queued' | 'running' | 'passed' | 'failed';
  progress: number;
  attempt: number;
};

const STAGES = ['install', 'build', 'test'] as const;

/** How many times each (pipeline, stage) has been polled since it was reset. */
const polls = new Map<string, number>();

const fetchStage = async (
  pipeline: string,
  stage: string
): Promise<StageState> => {
  await new Promise((resolve) => setTimeout(resolve, 250));

  const key = `${pipeline}/${stage}`;

  const attempt = (polls.get(key) || 0) + 1;

  polls.set(key, attempt);

  // each stage needs a different number of polls, so the shared clock is visible
  const needed = STAGES.indexOf(stage as (typeof STAGES)[number]) + 2;

  return {
    stage,
    attempt,
    progress: Math.min(100, Math.round((attempt / needed) * 100)),
    status: attempt >= needed ? 'passed' : attempt === 1 ? 'queued' : 'running',
  };
};

const stagePoll = pollLoader(fetchStage, {
  interval: 1500,
  /** The control stops polling as soon as this returns true. */
  isLoaded: (state) => state.status === 'passed' || state.status === 'failed',
  syncedKeysCount: 1,
});

/** `pause` / `resume` / `reset`, keyed by the *leading* keys - the pipeline. */
const pipelinePolling = stagePoll.actions;

const stageRegistry = createRegistry(createAsyncControl, stagePoll);

const PIPELINE = 'main';

const Stage: FC<{ stage: string }> = ({ stage }) => {
  const $stage = stageRegistry.get(PIPELINE, stage);

  return (
    <p style={{ margin: '0 0 .5rem' }}>
      <SuspenseControlConsumer
        control={$stage}
        fallback={<span className='muted'>{stage}: waiting…</span>}
        render={(state) => (
          <>
            <strong>{state.stage}</strong>{' '}
            <span className='muted'>
              {state.status} - {state.progress}% - poll #{state.attempt}
            </span>
            {/* selectLoading stays true while the poll is still going, so it is
                the honest "is this still moving" signal */}
            <ControlConsumer
              control={selectLoading($stage)}
              render={(isPolling) =>
                isPolling ? <span className='muted'> · polling</span> : null
              }
            />
          </>
        )}
      />
    </p>
  );
};

const PollController = () => {
  const [paused, setPaused] = useState(false);

  return (
    <button
      onClick={() => {
        if (paused) {
          pipelinePolling.resume(PIPELINE);
        } else {
          pipelinePolling.pause(PIPELINE);
        }

        setPaused(!paused);
      }}
    >
      {paused ? 'resume' : 'pause'}
    </button>
  );
};

const App: FC = () => {
  /** Polling in a background tab is waste - pause the whole pipeline at once. */
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        pipelinePolling.pause(PIPELINE);
      } else {
        pipelinePolling.resume(PIPELINE);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <>
      <h1>Polling</h1>
      <p className='lede'>
        Three stages of one pipeline, sharing a clock. Each stops polling by
        itself once it passes.
      </p>

      <Suspense fallback={null}>
        <fieldset>
          <legend>Pipeline: {PIPELINE}</legend>
          {STAGES.map((stage) => (
            <Stage key={stage} stage={stage} />
          ))}
          <p className='muted' style={{ marginBottom: 0 }}>
            They advance in step because <code>syncedKeysCount: 1</code> gives
            every stage of a pipeline one shared clock.
          </p>
        </fieldset>
      </Suspense>

      <fieldset>
        <legend>Controlling the clock</legend>
        <div className='row'>
          <PollController />
          <button
            onClick={() => {
              // start the run over, then poll now instead of waiting out the
              // interval. A no-op if a request is already in flight.
              polls.clear();

              stageRegistry.invalidate();
            }}
          >
            re-run the pipeline
          </button>
        </div>
        <p className='muted' style={{ marginBottom: 0 }}>
          Switching to another tab pauses it too - see the effect above.
        </p>
      </fieldset>
    </>
  );
};

export default App;
