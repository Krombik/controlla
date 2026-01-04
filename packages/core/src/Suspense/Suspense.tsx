import {
  type ContextType,
  type FC,
  type PropsWithChildren,
  type SuspenseProps,
  Suspense as ReactSuspense,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import SuspenseContext from '#utils/SuspenseContext';
import ErrorBoundaryContext from '#utils/ErrorBoundaryContext';
import noop from 'lodash.noop';

type Ctx = NonNullable<ContextType<typeof SuspenseContext>>;

const handleCleanup =
  (ctx: Ctx, errorBoundaryCtx: { delete(fn: () => void): void }) => () => {
    const it = ctx.values();

    for (let i = ctx.size; i--; ) {
      const unload = it.next().value!;

      unload();

      errorBoundaryCtx.delete(unload);
    }

    ctx.clear();
  };

/** @link https://github.com/facebook/react/blob/602917c8cb521e6f9b8eae7070985e2a698fc0d0/packages/react-reconciler/src/ReactFiberWorkLoop.js#L471 */
const FALLBACK_THROTTLE_MS = 500;

const Fallback: FC<PropsWithChildren<{ _ctx: Ctx }>> = (props) => {
  const ctx = props._ctx;

  const errorBoundaryCtx = useContext(ErrorBoundaryContext) || { delete: noop };

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => handleCleanup(ctx, errorBoundaryCtx), []);

  useLayoutEffect(() => {
    clearTimeout(timeoutRef.current!);
  }, []);

  if (timeoutRef.current == null) {
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = setTimeout(handleCleanup(ctx, errorBoundaryCtx));
    }, FALLBACK_THROTTLE_MS);
  }

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
  const ctx = useRef<Ctx>(new Map()).current;

  return (
    <ReactSuspense fallback={<Fallback _ctx={ctx}>{props.fallback}</Fallback>}>
      <SuspenseContext.Provider value={ctx}>
        {props.children}
      </SuspenseContext.Provider>
    </ReactSuspense>
  );
};

export default Suspense;
