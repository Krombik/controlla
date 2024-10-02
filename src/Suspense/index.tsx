import {
  ContextType,
  FC,
  Suspense as ReactSuspense,
  SuspenseProps as ReactSuspenseProps,
  useContext,
  useEffect,
  useRef,
} from 'react';
import SuspenseContext from '../utils/SuspenseContext';
import SkeletonContext from '../utils/SkeletonContext';
import noop from 'lodash.noop';

export type SuspenseProps = ReactSuspenseProps & {
  isSkeleton?: boolean;
};

const Suspense: FC<SuspenseProps> = (props) => {
  const isNotSkeleton =
    props.isSkeleton == null ? !useContext(SkeletonContext) : !props.isSkeleton;

  const ctx = useRef<NonNullable<ContextType<typeof SuspenseContext>>>(
    new Map()
  ).current;

  useEffect(
    isNotSkeleton
      ? () => () => {
          const it = ctx.values();

          for (let i = ctx.size; i--; ) {
            it.next().value();
          }

          ctx.clear();
        }
      : noop,
    [isNotSkeleton]
  );

  return isNotSkeleton ? (
    <SuspenseContext.Provider value={ctx}>
      <ReactSuspense {...props} />
    </SuspenseContext.Provider>
  ) : (
    props.fallback
  );
};

export default Suspense;
