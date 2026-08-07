import noop from '#internal/noop';
import DisposeContext from '#internal/DisposeContext';
import { INTERNALS } from '#internal/constants';
import type { PrimitiveControlInternals, RegistryBrand } from '#internal/types';
import type { ReadonlyControl } from '#types';
import {
  createContext,
  useContext,
  useRef,
  type FC,
  type PropsWithChildren,
} from 'react';

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
   * life, so the context itself never changes: rerenders come from the
   * controls in it, through `useValue` and friends.
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
  <T extends Record<string, ReadonlyControl | RegistryBrand>>(
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
  <T extends Record<string, ReadonlyControl | RegistryBrand>, P>(
    createControls: (parent: P) => T,
    useParentControls: () => P
  ): [Provider: FC<PropsWithChildren>, useControls: () => T];
} = <T extends Record<string, ReadonlyControl | RegistryBrand>>(
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
      ref.current = controls = createControls(parent);

      if (scope) {
        for (const key in controls) {
          // registries have no internals; a plain control has no cleanup
          const internals = (controls[key] as any)[INTERNALS] as
            PrimitiveControlInternals | undefined;

          if (internals && internals._cleanup) {
            scope.push(internals._cleanup);
          }
        }
      }
    }

    return <ContextProvider value={controls}>{props.children}</ContextProvider>;
  };

  const useControls = () => useContext(context) || throwNoProvider();

  return [ControlsProvider, useControls] as any;
};

export default createControlsContext;
