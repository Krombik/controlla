import {
  AnyAsyncState,
  NestedState,
  PausableLoadableAsyncStateOptions,
  PausableRoot,
  RootKey,
  State,
} from '../types';
import { EMPTY_ARR } from './constants';
import executeSetters from './executeSetters';
import setIsLoaded from './setIsLoaded';

const getAsyncStateCreator =
  (createState: (defaultValue?: any) => State | NestedState) =>
  ({
    value,
    isLoaded: checkIsLoaded,
    load,
    pause,
    resume,
    loadingTimeout,
  }: Partial<PausableLoadableAsyncStateOptions<any, any, any[]>>) => {
    const state = createState(value) as AnyAsyncState;

    const root = state.r as PausableRoot;

    const _setValue = root.get(RootKey.VALUE_SET)!;

    const slowLoadingSet = load && loadingTimeout && new Set<() => void>();

    let slowLoadingTimeoutId: ReturnType<typeof setTimeout> | undefined;

    let isFree = true;

    let isLoaded: boolean;

    let unlisten: ReturnType<NonNullable<typeof load>>;

    root.set(RootKey.ERROR_CALLBACK_SET, new Set());

    root.set(RootKey.IS_LOADED_CALLBACK_SET, new Set());

    root.set(RootKey.IS_LOADED, false);

    root.set(
      RootKey.VALUE_SET,
      (nextValue, rootValue, isSet, path, isError) => {
        isLoaded = isSet
          ? checkIsLoaded
            ? checkIsLoaded(root.get(RootKey.VALUE), rootValue)
            : isSet
          : isError;

        if (slowLoadingSet) {
          clearTimeout(slowLoadingTimeoutId);

          slowLoadingTimeoutId = isLoaded
            ? undefined
            : setTimeout(() => {
                executeSetters(slowLoadingSet);
              }, loadingTimeout);
        }

        if (isLoaded && unlisten) {
          unlisten = unlisten();
        }

        _setValue(nextValue, rootValue, isSet, path, isError);

        setIsLoaded({ r: root } as AnyAsyncState, isLoaded);
      }
    );

    if (load) {
      let count = 0;

      const cancel = () => {
        if (!--count && unlisten) {
          unlisten = unlisten();

          if (!isLoaded) {
            isFree = true;
          }
        }
      };

      root.set(RootKey.LOAD, (state, force) => {
        if (isFree && (force || !isLoaded)) {
          setIsLoaded(state, (isLoaded = isFree = false));

          if (slowLoadingSet) {
            slowLoadingTimeoutId = setTimeout(() => {
              executeSetters(slowLoadingSet);
            }, loadingTimeout);
          }

          unlisten = load.apply(
            { ...state, p: EMPTY_ARR },
            state.a || EMPTY_ARR
          );
        }

        count++;

        return cancel;
      });

      if (slowLoadingSet) {
        root.set(RootKey.SLOW_LOADING_CALLBACK_SET, slowLoadingSet);
      }

      if (pause && resume) {
        root.set(RootKey.RESUME, resume);
        root.set(RootKey.PAUSE, pause);
      }
    }

    return state as AnyAsyncState;
  };

export default getAsyncStateCreator;
