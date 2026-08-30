// the env module must come first: it installs the native globals
import { emitAppState, tick } from './_env/native.ts';
import assert from 'node:assert';
import test from 'node:test';

const { default: createAsyncControl } =
  await import('../build-native/core/createAsyncControl/index.js');
const { default: retain } =
  await import('../build-native/core/retain/index.js');
const { default: getValue } =
  await import('../build-native/core/getValue/index.js');

test('reloadOnFocus reloads when AppState comes back to active', async () => {
  let loads = 0;

  let answer!: (value: number) => void;

  const $c: any = createAsyncControl<number>({
    reloadOnFocus: 1,
    load(handle: any) {
      loads++;

      answer = (value) => handle.setValue(value);
    },
  });

  const release = retain($c);

  await tick();

  answer(1);

  await tick();

  assert.equal(loads, 1);
  assert.equal(getValue($c), 1);

  // stale enough for the focus to be worth a reload
  await new Promise((resolve) => setTimeout(resolve, 5));

  emitAppState('background');

  await tick();

  assert.equal(loads, 1, 'going away is not a reason to load');

  emitAppState('active');

  await tick();

  assert.equal(loads, 2, 'coming back to the front is');

  answer(2);

  await tick();

  release();
});

test('a hold let go of stops listening for the app coming back', async () => {
  let loads = 0;

  const $c: any = createAsyncControl<number>({
    reloadOnFocus: 1,
    load(handle: any) {
      loads++;

      handle.setValue(loads);
    },
  });

  const release = retain($c);

  await tick();

  assert.equal(loads, 1);

  release();

  // the microtask the unload is deferred by
  await tick();

  await new Promise((resolve) => setTimeout(resolve, 5));

  emitAppState('background');

  emitAppState('active');

  await tick();

  assert.equal(loads, 1, 'nothing holds it, so nothing reloads it');
});

test('useLink hands back onPress, and no onClick to attach to an anchor', async () => {
  const { default: createRouter } =
    await import('../build-native/router/createRouter/index.js');
  const { default: createPath } =
    await import('../build-native/router/createPath/index.js');
  const { default: param } =
    await import('../build-native/router/param/index.js');
  const { default: useLink } =
    await import('../build-native/router/useLink/index.js');
  const { default: selectParams } =
    await import('../build-native/router/selectParams/index.js');
  const { renderHook } = await import('./_env/hooks.ts');
  const { setInitialUrl } = await import('./_env/native.ts');

  setInitialUrl('myapp://item/1');

  const router = createRouter({
    item: createPath('item', param({ id: false })),
  });

  for (let i = 0; i < 4; i++) {
    await tick();
  }

  const { result: link } = renderHook(() =>
    useLink({ to: router.navigation.item({ id: '2' }) })
  );

  assert.equal(link.href, '/item/2', 'the path is still a path');
  assert.equal(typeof link.onPress, 'function');
  assert.equal(
    'onClick' in link,
    false,
    'there is no anchor to click - the native types do not carry one either'
  );

  link.onPress();

  for (let i = 0; i < 4; i++) {
    await tick();
  }

  assert.deepEqual(getValue(selectParams(router.routes.item)), { id: '2' });
});

test('a failed submit focuses the first field registered, not the first drawn', async () => {
  const { default: createControl } =
    await import('../build-native/core/createControl/index.js');
  const { default: useForm } =
    await import('../build-native/form/useForm/index.js');
  const { default: Field } =
    await import('../build-native/form/Field/index.js');
  const { default: Validator } =
    await import('../build-native/form/Validator/index.js');
  const { default: FormProvider } =
    await import('../build-native/form/FormProvider/index.js');
  const { renderHook } = await import('./_env/hooks.ts');
  const { contextOf } = await import('./_env/context.ts');

  const FormContext: any = contextOf(
    FormProvider({ form: undefined as any, children: null })
  );

  const $values = createControl({ first: '', second: '' });

  const focused: string[] = [];

  const form: any = renderHook(() =>
    (useForm as any)($values, { submit: () => {} })
  ).result;

  const under = <T>(render: () => T) =>
    renderHook(render, (run) => {
      FormContext._currentValue = form;

      try {
        return run();
      } finally {
        FormContext._currentValue = undefined;
      }
    });

  // registered second, but a native tree has no document order to rank it by
  const bind = (name: 'first' | 'second') =>
    under(
      () =>
        (Field as any)({
          control: $values[name],
          render: (props: any) => props,
        }) as { ref(el: unknown): void }
    ).result.ref({ focus: () => focused.push(name) });

  bind('second');

  bind('first');

  under(() =>
    (Validator as any)({
      control: $values,
      validate: () => 'nope',
      validateOn: 'submit',
    })
  );

  await form.submit();

  assert.deepEqual(
    focused,
    ['second'],
    'the first one registered is what stands in'
  );
});
