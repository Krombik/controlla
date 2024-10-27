import {
  ContextType,
  FC,
  PropsWithChildren,
  Suspense as ReactSuspense,
  SuspenseProps,
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
      for (let i = ctx.length; i--; ) {
        const unload = ctx[i];

        unload();

        errorBoundaryCtx.delete(unload);
      }

      ctx.length = 0;
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
