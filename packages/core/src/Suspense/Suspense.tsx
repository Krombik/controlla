import {
  type ContextType,
  type FC,
  type PropsWithChildren,
  type SuspenseProps,
  Suspense as ReactSuspense,
  useContext,
  useEffect,
  useRef,
} from 'react';
import SuspenseContext from '#internal/SuspenseContext';
import ErrorBoundaryContext from '#internal/ErrorBoundaryContext';
import scheduleMicrotask from '#internal/scheduleMicrotask';
import noop from 'lodash.noop';

type Ctx = NonNullable<ContextType<typeof SuspenseContext>>;

/** @link https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberWorkLoop.js#L531 */
const FALLBACK_THROTTLE_MS = 501;

let queue: Array<() => void> = [];

let indexMap = new Map<() => void, number>();

let timeoutId: null | ReturnType<typeof setTimeout> = null;

const nextTick = () => {
  queue = [];

  indexMap = new Map();

  timeoutId = null;
};

const Fallback: FC<PropsWithChildren<{ _ctx: Ctx }>> = (props) => {
  const errorBoundaryCtx = useContext(ErrorBoundaryContext);

  const effectRef = useRef(noop);

  if (effectRef.current == noop) {
    const ctx = props._ctx;

    const currQueue = queue;

    const currIndexMap = indexMap;

    const cleanup = () => {
      for (let i = 0; i < ctx.length; i++) {
        ctx[i]._detach(undefined, undefined, true);
      }

      if (errorBoundaryCtx) {
        errorBoundaryCtx.delete(ctx);
      }

      ctx.length = 0;
    };

    currIndexMap.set(cleanup, currQueue.length);

    currQueue.push(cleanup);

    if (timeoutId == null) {
      timeoutId = setTimeout(() => {
        const l = currQueue.length;

        for (let i = 0; i < l; i++) {
          currQueue[i]();
        }
      }, FALLBACK_THROTTLE_MS);

      scheduleMicrotask(nextTick);
    }

    const currTimeoutId = timeoutId;

    effectRef.current = () => {
      if (currQueue.length != 1) {
        const last = currQueue.pop()!;

        if (last != cleanup) {
          const index = currIndexMap.get(cleanup)!;

          currQueue[index] = last;

          currIndexMap.set(last, index);
        }

        currIndexMap.delete(cleanup);
      } else {
        clearTimeout(currTimeoutId);
      }

      return cleanup;
    };
  }

  useEffect(effectRef.current, []);

  return props.children;
};

/**
 * A custom `Suspense` component that extends React's {@link React.Suspense Suspense} to manage loading and error handling across multiple components.
 * @example
 * ```tsx
 * <Suspense fallback={<div>Loading...</div>}>
 *   <SomeAsyncComponent />
 * </Suspense>
 * ```
 */
const Suspense: FC<SuspenseProps> = (props) => {
  const ctx = useRef<Ctx>([]).current;

  return (
    <ReactSuspense fallback={<Fallback _ctx={ctx}>{props.fallback}</Fallback>}>
      <SuspenseContext.Provider value={ctx}>
        {props.children}
      </SuspenseContext.Provider>
    </ReactSuspense>
  );
};

export default Suspense;
