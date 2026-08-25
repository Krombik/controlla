// the env module must come first: it installs a real DOM before React loads
import { act, createElement as h, mount } from './_env/react.ts';
import assert from 'node:assert';
import test from 'node:test';

// every lib module from the build, none from `src`: the two are separate module
// graphs, and a bag's controls report into the `cleanupScope` of whichever one
// made them
const { default: createControlsContext } =
  await import('../build/core/createControlsContext/index.js');
const { default: createControl } =
  await import('../build/core/createControl/index.js');
const { default: createDerivedControl } =
  await import('../build/core/createDerivedControl/index.js');
const { default: useValue } = await import('../build/core/useValue/index.js');
const { default: setValue } = await import('../build/core/setValue/index.js');

test('a controls context builds a bag per provider and lets it go on unmount', async () => {
  const $source = createControl(1);

  /** What the bag's external-storage control is observing with, per provider. */
  const observing: boolean[] = [];

  const storage = () => {
    const index = observing.push(false) - 1;

    return {
      get: () => 'stored',
      set: () => {},
      observe: () => {
        observing[index] = true;

        return () => {
          observing[index] = false;
        };
      },
    };
  };

  const [Provider, useControls] = createControlsContext(() => ({
    $doubled: createDerivedControl($source, (n: number) => n * 2),
    $stored: createControl(undefined, storage),
  }));

  const renders: number[] = [];

  const Reader = () => {
    const { $doubled } = useControls() as any;

    renders.push(useValue($doubled) as number);

    return null;
  };

  const first = await mount(h(Provider, null, h(Reader, null)));

  assert.deepEqual(renders, [2], 'the bag is built and read in the render');
  assert.deepEqual(observing, [true], 'the insertion effect subscribed it');

  await act(async () => {
    setValue($source, 3);
  });

  assert.deepEqual(renders, [2, 6], 'a source change reaches the reader');

  // a second provider is a bag of its own over the same source
  const second = await mount(h(Provider, null, h(Reader, null)));

  assert.deepEqual(renders, [2, 6, 6]);
  assert.deepEqual(observing, [true, true], 'one subscription per provider');

  await second.unmount();

  assert.deepEqual(
    observing,
    [true, false],
    'the unmounted bag let go, the mounted one did not'
  );

  await act(async () => {
    setValue($source, 4);
  });

  assert.deepEqual(renders, [2, 6, 6, 8], 'the one still up still follows');

  await first.unmount();

  assert.deepEqual(observing, [false, false], 'nothing of either bag is left');
});

test('a bag reads the enclosing one, and the hook outside its provider throws', async () => {
  const [OuterProvider, useOuter] = createControlsContext(() => ({
    $base: createControl(5),
  }));

  const [InnerProvider, useInner] = createControlsContext(
    ({ $base }: any) => ({
      $twice: createDerivedControl($base, (n: number) => n * 2),
    }),
    useOuter
  );

  const seen: number[] = [];

  const Reader = () => {
    seen.push(useValue((useInner() as any).$twice) as number);

    return null;
  };

  await mount(h(OuterProvider, null, h(InnerProvider, null, h(Reader, null))));

  assert.deepEqual(seen, [10], 'the inner bag derived off the outer one');

  // React swallows nothing: the render that read no provider is what throws
  await assert.rejects(
    mount(h(Reader, null)),
    /no controls provider/,
    'the hook outside its provider says so'
  );
});
