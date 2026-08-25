// the env module must come first: it installs a real DOM before React loads
import { act, createElement as h, mount } from './_env/react.ts';
import assert from 'node:assert';
import test from 'node:test';
import { Component, Suspense, type ReactNode } from 'react';
import createAsyncControl from '../src/core/createAsyncControl/index.ts';
import useSuspenseValues from '../src/core/useSuspenseValues/index.ts';

/** An async control whose load answers only when the test says so. */
const loadable = () => {
  let handle!: { setValue(value: any): void; setError(error: any): void };

  let loads = 0;

  const $control: any = createAsyncControl<any>({
    load(next: any) {
      loads++;

      handle = next;
    },
  });

  return {
    $control,
    answer: (value: any) => handle.setValue(value),
    fail: (error: any) => handle.setError(error),
    get loads() {
      return loads;
    },
  };
};

class Boundary extends Component<{ children: ReactNode }, { error: any }> {
  state = { error: undefined as any };

  static getDerivedStateFromError(error: any) {
    return { error };
  }

  render() {
    return this.state.error
      ? h('span', null, `caught:${this.state.error.message}`)
      : this.props.children;
  }
}

const suspending = (read: () => ReactNode) =>
  h(
    Boundary,
    null,
    h(
      Suspense,
      { fallback: h('span', null, 'loading') },
      h(() => read())
    )
  );

test('a tuple suspends until every one of them is there', async () => {
  const a = loadable();

  const b = loadable();

  const app = await mount(
    suspending(() => {
      const [first, second] = useSuspenseValues([a.$control, b.$control]);

      return h('span', null, `${first}/${second}`);
    })
  );

  assert.equal(app.container.textContent, 'loading');
  assert.equal(a.loads, 1, 'the suspension started both loads');
  assert.equal(b.loads, 1);

  await act(async () => {
    a.answer('A');
  });

  assert.equal(app.container.textContent, 'loading', 'one of two is not both');

  await act(async () => {
    b.answer('B');
  });

  assert.equal(app.container.textContent, 'A/B');

  await app.unmount();
});

test('a falsy entry is a value of undefined, and nothing to wait for', async () => {
  const a = loadable();

  const app = await mount(
    suspending(() => {
      const [first, second, third] = useSuspenseValues([
        a.$control,
        false,
        a.$control,
      ]);

      return h('span', null, `${first}/${second}/${third}`);
    })
  );

  assert.equal(app.container.textContent, 'loading');

  await act(async () => {
    a.answer('A');
  });

  assert.equal(app.container.textContent, 'A/undefined/A');

  await app.unmount();
});

test('an error goes to the boundary, or comes back as one with safeReturn', async () => {
  const a = loadable();

  const b = loadable();

  const thrown = await mount(
    suspending(() => {
      const [first, second] = useSuspenseValues([a.$control, b.$control]);

      return h('span', null, `${first}/${second}`);
    })
  );

  await act(async () => {
    a.answer('A');

    b.fail(new Error('boom'));
  });

  assert.equal(thrown.container.textContent, 'caught:boom');

  await thrown.unmount();

  const c = loadable();

  const d = loadable();

  const safe = await mount(
    suspending(() => {
      const [values, errors] = useSuspenseValues(
        [c.$control, d.$control],
        true
      );

      return h(
        'span',
        null,
        `${values[0]}/${values[1]}|${errors[0]}/${(errors[1] as any)?.message}`
      );
    })
  );

  assert.equal(safe.container.textContent, 'loading');

  await act(async () => {
    c.answer('C');

    d.fail(new Error('nope'));
  });

  assert.equal(
    safe.container.textContent,
    'C/undefined|undefined/nope',
    'the failing slot is an error, the other one a value'
  );

  await safe.unmount();
});
