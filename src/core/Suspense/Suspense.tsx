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
import noop from '#internal/noop';
import { EMPTY_ARR } from '#internal/constants';

type Ctx = NonNullable<ContextType<typeof SuspenseContext>>;

// https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberWorkLoop.js#L531
// just above React's fallback throttle: a fallback that committed has run its effect by then
const FALLBACK_THROTTLE_MS = 501;

// release-cleanups of fallbacks rendered this tick: a committed fallback removes
// its own (the effect ran), the timeout releases the rest (render was discarded)
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

  useEffect(effectRef.current, EMPTY_ARR);

  return props.children;
};

/**
 * A drop-in replacement for React's {@link React.Suspense Suspense}, required
 * for this library's suspense hooks (`useSuspenseValue` and the like) — use it
 * instead of `React.Suspense` around components using them.
 *
 * A suspended component starts loading before it ever commits, so React
 * can't clean that loading up. This boundary tracks such loadings and
 * releases them when the suspension resolves or the boundary goes away.
 *
 * @example
 * ```tsx
 * const User = () => {
 *   const user = useSuspenseValue($user);
 *
 *   return <h2>{user.name}</h2>;
 * };
 *
 * <Suspense fallback={<p>Loading...</p>}>
 *   <User />
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
