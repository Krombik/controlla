import noop from '#internal/noop';
import DisposeContext from '#internal/DisposeContext';
import {
  createContext,
  useContext,
  useRef,
  type FC,
  type PropsWithChildren,
} from 'react';
import { cleanupScope } from '#internal/cleanup';

const throwNoProvider = () => {
  throw new Error('no controls provider');
};

const createControlsContext: {
  /**
   * Creates a provider holding a bag of controls and registries, built by
   * {@link createControls} for every mounted provider - so a subtree gets its own copy
   * of the state instead of sharing a module-level one, and nothing leaks
   * between requests on the server - paired with the hook that reads it, which
   * throws outside the provider.
   *
   * The bag is built on the provider's first render and kept for its whole
   * life, so the context itself never changes.
   *
   * @example
   * ```tsx
   * const [SearchProvider, useSearch] = createControlsContext(() => ({
   *   query: createPrimitiveControl(''),
   *   page: createPrimitiveControl(1),
   * }));
   *
   * const Input = () => {
   *   const { query } = useSearch();
   *
   *   return <input value={useValue(query)} />;
   * };
   *
   * const Page = () => (
   *   <SearchProvider>
   *     <Input />
   *   </SearchProvider>
   * );
   * ```
   */
  <T>(
    createControls: () => T
  ): [Provider: FC<PropsWithChildren>, useControls: () => T];
  /**
   * Same, for a bag built on top of an enclosing one:
   * {@link useParentControls} reads it and {@link createControls} receives it. Any
   * hook does, so it can pull from several contexts at once - the provider
   * then has to be rendered inside whatever that hook needs.
   *
   * {@link useParentControls} runs on every render while {@link createControls} runs
   * once, so the bag keeps the parent it saw first - which is what you want,
   * since a bag's controls outlive its provider's renders.
   *
   * @example
   * ```tsx
   * const [FiltersProvider, useFilters] = createControlsContext(
   *   ({ query }) => ({
   *     tags: createPrimitiveControl<string[]>([]),
   *     hits: createDerivedControl(query, search),
   *   }),
   *   useSearch
   * );
   * ```
   */
  <T, P>(
    createControls: (parent: P) => T,
    useParentControls: () => P
  ): [Provider: FC<PropsWithChildren>, useControls: () => T];
} = <T,>(
  createControls: (parent: any) => T,
  useParentControls: () => any = noop
) => {
  const context = createContext<T>(null!);

  const ContextProvider = context.Provider;

  const ControlsProvider: FC<PropsWithChildren> = (props) => {
    const parent = useParentControls();

    const scope = useContext(DisposeContext);

    const ref = useRef<T | null>(null);

    let controls = ref.current;

    if (controls === null) {
      cleanupScope._value = scope;

      try {
        ref.current = controls = createControls(parent);
      } finally {
        cleanupScope._value = null;
      }
    }

    return <ContextProvider value={controls}>{props.children}</ContextProvider>;
  };

  const useControls = () => useContext(context) || throwNoProvider();

  return [ControlsProvider, useControls] as any;
};

export default createControlsContext;
