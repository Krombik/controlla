// the env module must come first: it installs a real DOM before React loads
import { act, createElement as h, mount } from './_env/react.ts';
import assert from 'node:assert';
import test from 'node:test';
import {
  Activity,
  StrictMode,
  Suspense,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
} from 'react';
import useControl from '../src/core/useControl/index.ts';
import useDerivedControl from '../src/core/useDerivedControl/index.ts';
import useSnapshotControl from '../src/core/useSnapshotControl/index.ts';
import useAsyncControl from '../src/core/useAsyncControl/index.ts';
import useBoundControl from '../src/core/useBoundControl/index.ts';
import useInfiniteValues from '../src/core/useInfiniteValues/index.ts';
import createRegistry from '../src/core/createRegistry/index.ts';
import createControl from '../src/core/createControl/index.ts';
import setValue from '../src/core/setValue/index.ts';
import { INTERNALS } from '../src/core/_internal/constants.ts';
import useForm from '../src/form/useForm/index.ts';
import FormProvider from '../src/form/FormProvider/index.ts';
import NativeField from '../src/form/NativeField/index.ts';
import useValidator from '../src/form/useValidator/index.ts';
import getValue from '../src/core/getValue/index.ts';
import useValue from '../src/core/useValue/index.ts';
import ControlConsumer from '../src/core/ControlConsumer/index.ts';
import ControlsConsumer from '../src/core/ControlsConsumer/index.ts';
import noop from '../src/core/_internal/noop.ts';
import type { SyncExternalStorage } from '../src/core/types.ts';

test('every insertion effect of a commit runs before every layout one', async () => {
  const log: string[] = [];

  const Leaf = () => {
    useInsertionEffect(() => {
      log.push('leaf insertion');
    });

    useLayoutEffect(() => {
      log.push('leaf layout');
    });

    useEffect(() => {
      log.push('leaf passive');
    });

    return null;
  };

  const Root = () => {
    useInsertionEffect(() => {
      log.push('root insertion');
    });

    useLayoutEffect(() => {
      log.push('root layout');
    });

    useEffect(() => {
      log.push('root passive');
    });

    return h(Leaf);
  };

  await mount(h(Root));

  assert.deepEqual(log, [
    'leaf insertion',
    'root insertion',
    'leaf layout',
    'root layout',
    'leaf passive',
    'root passive',
  ]);
});

test('a control caught up by its own mount reaches the reader below it', async () => {
  let stored = 'a';

  const storage: SyncExternalStorage<string> = () => ({
    get: () => stored,
    set: (value) => {
      stored = value;
    },
    observe: () => noop,
  });

  const seen: string[] = [];

  const Reader = ({ control }: any) => {
    seen.push(useValue(control) as string);

    return null;
  };

  const Owner = () => {
    const $text = useControl(undefined as any, storage);

    // the window the catch-up is for: the storage moves after the control was
    // made and before anything of this commit is attached
    stored = 'b';

    return h(Reader, { control: $text });
  };

  await mount(h(Owner));

  assert.deepEqual(
    seen,
    ['a', 'b'],
    'the render read what there was, the mount took the rest'
  );
});

test('a suspense boundary re-runs layout effects and leaves passive ones alone', async () => {
  const log: string[] = [];

  let release: (() => void) | undefined;

  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });

  let settled = false;

  const Sometimes = () => {
    if (!settled) {
      throw pending.then(() => {
        settled = true;
      });
    }

    return null;
  };

  const Kept = () => {
    useLayoutEffect(() => {
      log.push('layout on');

      return () => {
        log.push('layout off');
      };
    }, []);

    useEffect(() => {
      log.push('passive on');

      return () => {
        log.push('passive off');
      };
    }, []);

    return null;
  };

  const App = ({ show }: any) =>
    h(Suspense, { fallback: null }, h(Kept), show ? h(Sometimes) : null);

  const tree = await mount(h(App, { show: false }));

  assert.deepEqual(log, ['layout on', 'passive on']);

  log.length = 0;

  // an update makes a sibling suspend, so the committed content is hidden
  await tree.render(h(App, { show: true }));

  assert.deepEqual(
    log,
    ['layout off'],
    'the layout effect is torn down and the passive one is not'
  );

  log.length = 0;

  await act(async () => {
    release!();
  });

  assert.deepEqual(log, ['layout on'], 'and only that one comes back');
});

test('Activity tears down passive effects too', async () => {
  const log: string[] = [];

  const Kept = () => {
    useLayoutEffect(() => {
      log.push('layout on');

      return () => {
        log.push('layout off');
      };
    }, []);

    useEffect(() => {
      log.push('passive on');

      return () => {
        log.push('passive off');
      };
    }, []);

    return null;
  };

  const App = ({ mode }: any) => h(Activity as any, { mode }, h(Kept));

  const tree = await mount(h(App, { mode: 'visible' }));

  log.length = 0;

  await tree.render(h(App, { mode: 'hidden' }));

  assert.deepEqual(
    log.slice().sort(),
    ['layout off', 'passive off'],
    'unlike a suspense hide, this one takes both'
  );

  log.length = 0;

  await tree.render(h(App, { mode: 'visible' }));

  assert.deepEqual(log.slice().sort(), ['layout on', 'passive on']);
});

test('a native field typed into moves the control and the form with it', async () => {
  const seen: boolean[] = [];

  const Dirty = ({ form }: any) => {
    seen.push(useValue(form.$isDirty) as boolean);

    return null;
  };

  let handle: any;

  const App = () => {
    const $values = useControl({ email: '' });

    const form = useForm($values, { submit: noop } as any);

    handle = { $values, form };

    return h(
      FormProvider,
      { form },
      h(NativeField, {
        type: 'email',
        control: $values.email,
        render: (props: any) => h('input', props),
      } as any),
      h(Dirty, { form })
    );
  };

  const tree = await mount(h(App));

  const input: any = tree.container.querySelector('input');

  assert.ok(input, 'the field rendered a real input');
  assert.equal(getValue(handle.$values.email), '');
  assert.deepEqual(seen, [false]);

  // what typing is: the element owns the value and reports it
  await act(async () => {
    input.value = 'a@b.c';

    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });

  assert.equal(
    getValue(handle.$values.email),
    'a@b.c',
    'the control took what the element holds'
  );
  assert.deepEqual(seen, [false, true], 'and the form reads as dirty once');

  // and a reset puts the element back, without the field rerendering
  await act(async () => {
    handle.form.reset();
  });

  assert.equal(input.value, '', 'the element was written back');
  assert.deepEqual(seen, [false, true, false]);
});

test('a field that goes and comes back is dirty against the same baseline', async () => {
  let handle: any;

  const App = ({ show }: any) => {
    const $values = useControl({ email: '' });

    const form = useForm($values, { submit: noop } as any);

    handle = { $values, form };

    return h(
      FormProvider,
      { form },
      show
        ? h(NativeField, {
            type: 'email',
            control: $values.email,
            render: (props: any) => h('input', props),
          } as any)
        : null
    );
  };

  const tree = await mount(h(App, { show: true }));

  const dirty = () => getValue(handle.form.$isDirty);

  await act(async () => {
    const input: any = tree.container.querySelector('input');

    input.value = 'typed';

    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });

  assert.equal(dirty(), true);

  // the field goes, and its own entry with it
  await tree.render(h(App, { show: false }));

  assert.equal(tree.container.querySelector('input'), null);
  assert.equal(
    (handle.form as any)._entries.has(handle.$values.email),
    false,
    'the field it was is registered no more'
  );
  assert.equal(
    dirty(),
    true,
    'but the form is over the control, which still holds the edit'
  );

  // and comes back to the value it left and the baseline it had
  await tree.render(h(App, { show: true }));

  const input: any = tree.container.querySelector('input');

  assert.equal(input.value, 'typed', 'the element is filled in again');
  assert.equal(dirty(), true, 'and it is what it was against the baseline');
});

test('an Activity-hidden form keeps the baseline it was mounted with', async () => {
  let handle: any;

  const Form = () => {
    const $values = useControl({ email: '' });

    const form = useForm($values, { submit: noop } as any);

    handle = { $values, form };

    return h(
      FormProvider,
      { form },
      h(NativeField, {
        type: 'email',
        control: $values.email,
        render: (props: any) => h('input', props),
      } as any)
    );
  };

  // around the form itself: this is what takes the passive effect that
  // baselines down and brings it back
  const App = ({ mode }: any) => h(Activity as any, { mode }, h(Form));

  const tree = await mount(h(App, { mode: 'visible' }));

  await act(async () => {
    const input: any = tree.container.querySelector('input');

    input.value = 'typed';

    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });

  assert.equal(getValue(handle.form.$isDirty), true);

  await tree.render(h(App, { mode: 'hidden' }));

  await tree.render(h(App, { mode: 'visible' }));

  assert.equal(
    getValue(handle.$values.email),
    'typed',
    'the state came through the hide'
  );
  assert.equal(getValue(handle.form.$isDirty), true);

  // what the baseline is, measured: back to what the form started with
  await act(async () => {
    const input: any = tree.container.querySelector('input');

    input.value = '';

    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });

  assert.equal(
    getValue(handle.form.$isDirty),
    false,
    'a second mount is no reason to call the edit the baseline'
  );
});

test('StrictMode mounts everything twice and nothing is attached twice', async () => {
  const renders: string[] = [];

  let handle: any;

  const Row = ({ $source }: any) => {
    const $doubled = useDerivedControl($source, (value: number) => value * 2);

    renders.push('row');

    return h('span', null, String(useValue($doubled)));
  };

  const App = () => {
    const $count = useControl(1);

    handle = $count;

    renders.push('app');

    return h(Row, { $source: $count });
  };

  const tree = await mount(h(StrictMode, null, h(App)));

  assert.equal(tree.container.textContent, '2');

  const internals = (handle as any)[INTERNALS]._root;

  assert.equal(
    internals._dependents.length,
    1,
    'one derived followed it, however many times React mounted'
  );

  await act(async () => {
    setValue(handle, 5);
  });

  assert.equal(tree.container.textContent, '10', 'and it hears the write once');

  const before = renders.length;

  await act(async () => {
    setValue(handle, 5);
  });

  assert.equal(renders.length, before, 'the same value rerenders nothing');
});

test('a write rerenders the path that reads it and nothing else', async () => {
  const renders: string[] = [];

  let handle: any;

  const Watch = ({ control, tag }: any) => {
    renders.push(tag);

    return h('span', null, String(useValue(control)));
  };

  const App = () => {
    const $values = useControl({ a: '1', b: '2' });

    handle = $values;

    renders.push('app');

    return h(
      'div',
      null,
      h(Watch, { control: $values.a, tag: 'a' }),
      h(Watch, { control: $values.b, tag: 'b' })
    );
  };

  const tree = await mount(h(App));

  assert.equal(tree.container.textContent, '12');

  renders.length = 0;

  await act(async () => {
    setValue(handle.a, '9');
  });

  assert.deepEqual(renders, ['a'], 'the one that reads that path, alone');
  assert.equal(tree.container.textContent, '92');

  renders.length = 0;

  // the whole object moves, but only one path of it actually changed
  await act(async () => {
    setValue(handle, { a: '9', b: '8' });
  });

  assert.deepEqual(renders, ['b'], 'and only the path that moved with it');
  assert.equal(tree.container.textContent, '98');
});

test('a bound list follows its rows as they come and go', async () => {
  const reg = createRegistry(createControl, (id: number) => ({ n: id }));

  const List = ({ ids }: any) => {
    const bind = useBoundControl(reg);

    const values = useInfiniteValues(ids.map((id: number) => bind(id)));

    return h(
      'div',
      null,
      ...values.map((value: any, index: number) =>
        h('span', { key: index }, String(value && value.n))
      )
    );
  };

  const tree = await mount(h(List, { ids: [1, 2] }));

  assert.equal(tree.container.textContent, '12');

  const followers = (id: number) =>
    (reg.get(id) as any)[INTERNALS]._root._dependents.length;

  assert.equal(followers(1), 1, 'one bound control per row');

  // a row arrives
  await tree.render(h(List, { ids: [1, 2, 3] }));

  assert.equal(tree.container.textContent, '123');
  assert.equal(followers(3), 1);

  // an item moves under the row bound to it
  await act(async () => {
    setValue(reg.get(2), { n: 99 });
  });

  assert.equal(tree.container.textContent, '1993');

  // the rows shrink, and what they bound goes with them
  await tree.render(h(List, { ids: [1] }));

  assert.equal(tree.container.textContent, '1');
  assert.equal(followers(2), 0, 'the row that went let go of its item');
  assert.equal(followers(3), 0);
  assert.equal(followers(1), 1, 'and the one that stayed did not');

  await tree.unmount();

  assert.equal(followers(1), 0, 'nothing is left following anything');
});

test('a blur runs the rule and the error lands on the element itself', async () => {
  const renders: string[] = [];

  let handle: any;

  const Rule = ({ control }: any) => {
    (useValidator as any)(
      control,
      (value: string) => (value.includes('@') ? undefined : 'invalid'),
      'blur'
    );

    return null;
  };

  const App = () => {
    const $values = useControl({ email: '' });

    const form = useForm($values, { submit: noop } as any);

    handle = { $values, form };

    renders.push('app');

    return h(
      FormProvider,
      { form },
      h(Rule, { control: $values.email }),
      h(NativeField, {
        type: 'email',
        control: $values.email,
        errorId: 'email-error',
        describedBy: 'hint',
        render: (props: any) => h('input', props),
      } as any)
    );
  };

  const tree = await mount(h(App));

  const input: any = tree.container.querySelector('input');

  assert.equal(input.getAttribute('aria-invalid'), null);
  assert.equal(input.getAttribute('aria-describedby'), 'hint');

  const before = renders.length;

  await act(async () => {
    input.value = 'nope';

    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });

  assert.equal(
    input.getAttribute('aria-invalid'),
    null,
    'typing is not when it runs'
  );

  await act(async () => {
    input.dispatchEvent(new Event('focusout', { bubbles: true }));
  });

  assert.equal(getValue(handle.$values.email), 'nope');
  assert.equal(input.getAttribute('aria-invalid'), 'true', 'the blur ran it');
  assert.equal(
    input.getAttribute('aria-describedby'),
    'hint email-error',
    'and what describes it now names the error'
  );
  assert.equal(renders.length, before, 'none of which rerendered anything');

  // passing takes it back off
  await act(async () => {
    input.value = 'a@b.c';

    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });

  assert.equal(input.getAttribute('aria-invalid'), null);
  assert.equal(input.getAttribute('aria-describedby'), 'hint');
});

test('a snapshot over a source that is already there mounts with nothing to follow', async () => {
  const $src = createControl(2);

  const seen: number[] = [];

  const Reader = () => {
    // everything it was after was there in the render, so the creation
    // registered nothing - the mount still has to go through
    seen.push(
      useValue(useSnapshotControl($src as any, (v: number) => v * 3)) as number
    );

    return null;
  };

  const app = await mount(h(Reader, null));

  assert.deepEqual(seen, [6]);

  await act(async () => {
    setValue($src, 10);
  });

  assert.deepEqual(seen, [6], 'once means once, and it heard nothing');

  await app.unmount();
});

test('and a snapshot that had to wait for one still follows it', async () => {
  const seen: Array<number | undefined> = [];

  let write: (value: number) => void = noop;

  const Reader = () => {
    const $src = useAsyncControl<number>();

    write = (value) => setValue($src, value);

    const $snap = useSnapshotControl($src as any, (v: number) => v * 3);

    seen.push(useValue($snap) as number | undefined);

    return null;
  };

  await mount(h(Reader, null));

  assert.deepEqual(seen, [undefined], 'nothing to compute from yet');

  await act(async () => {
    write(4);
  });

  assert.deepEqual(seen, [undefined, 12], 'the value it was waiting for');

  await act(async () => {
    write(7);
  });

  assert.deepEqual(seen, [undefined, 12], 'and it stopped there');
});

test('a snapshot that settled while mounted stays settled through an Activity', async () => {
  const seen: Array<number | undefined> = [];

  let write: (value: number) => void = noop;

  const Reader = () => {
    const $src = useAsyncControl<number>();

    write = (value) => setValue($src, value);

    seen.push(
      useValue(useSnapshotControl($src as any, (v: number) => v * 3)) as
        number | undefined
    );

    return null;
  };

  const app = await mount(
    h(Activity as any, { mode: 'visible' }, h(Reader, null))
  );

  await act(async () => {
    write(4);
  });

  assert.deepEqual(seen, [undefined, 12]);

  // hiding takes its subscription down and showing puts it back up - what it
  // was after it already has, so neither is anything it hears through
  await app.render(h(Activity as any, { mode: 'hidden' }, h(Reader, null)));

  await act(async () => {
    write(9);
  });

  await app.render(h(Activity as any, { mode: 'visible' }, h(Reader, null)));

  assert.equal(seen[seen.length - 1], 12, 'still the one it took');
});

test('a control consumer renders its value, gates children, or is the value', async () => {
  const $name = createControl('ada');

  const $shown = createControl(true);

  const app = await mount(
    h(
      'div',
      null,
      h(ControlConsumer as any, {
        control: $name,
        render: (name: string) => h('i', null, name),
      }),
      h(ControlConsumer as any, { control: $shown }, h('b', null, 'here')),
      h(ControlConsumer as any, { control: $name })
    )
  );

  assert.equal(app.container.textContent, 'adahereada');

  await act(async () => {
    setValue($name, 'grace');

    setValue($shown, false);
  });

  assert.equal(
    app.container.textContent,
    'gracegrace',
    'the gate closed and both readings moved'
  );

  await app.unmount();
});

test('a controls consumer takes an entry going falsy without losing its place', async () => {
  const $a = createControl('a');

  const $b = createControl('b');

  const renders: string[] = [];

  const App = ({ withB }: any) =>
    h(ControlsConsumer as any, {
      controls: [$a, withB && $b],
      render: (a: string, b: string | undefined) => {
        renders.push(`${a}|${b}`);

        return null;
      },
    });

  const app = await mount(h(App, { withB: true }));

  assert.deepEqual(renders, ['a|b']);

  // the entry goes falsy: its slot keeps the hook it had, so the one beside it
  // is still the same subscription
  await app.render(h(App, { withB: false }));

  assert.deepEqual(renders, ['a|b', 'a|undefined']);

  await act(async () => {
    setValue($b, 'B');
  });

  assert.deepEqual(renders, ['a|b', 'a|undefined'], 'nothing follows it now');

  await act(async () => {
    setValue($a, 'A');
  });

  assert.deepEqual(renders, ['a|b', 'a|undefined', 'A|undefined']);

  await app.render(h(App, { withB: true }));

  assert.deepEqual(renders, ['a|b', 'a|undefined', 'A|undefined', 'A|B']);

  await act(async () => {
    setValue($b, 'BB');
  });

  assert.deepEqual(
    renders,
    ['a|b', 'a|undefined', 'A|undefined', 'A|B', 'A|BB'],
    'and it follows again'
  );

  await app.unmount();
});
