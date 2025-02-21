import {
  type ContextType,
  type FC,
  type PropsWithChildren,
  Suspense as ReactSuspense,
  type SuspenseProps,
  useContext,
  useEffect,
  useRef,
} from 'react';
import SuspenseContext from '../utils/SuspenseContext';
import ErrorBoundaryContext from '../utils/ErrorBoundaryContext';
import noop from 'lodash.noop';

type Ctx = NonNullable<ContextType<typeof SuspenseContext>>;

const Fallback: FC<PropsWithChildren<{ _ctx: Ctx }>> = (props) => {
  const ctx = props._ctx;

  const errorBoundaryCtx = useContext(ErrorBoundaryContext) || { delete: noop };

  useEffect(
    () => () => {
      const it = ctx.values();

      for (let i = ctx.size; i--; ) {
        const unload = it.next().value;

        unload();

        errorBoundaryCtx.delete(unload);
      }

      ctx.clear();
    },
    []
  );

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
