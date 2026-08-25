// the env module must come first: it installs a real DOM before React loads
import { act, createElement as h, mount } from './_env/react.ts';
import assert from 'node:assert';
import test from 'node:test';
import { Activity, useEffect } from 'react';

// the built modules throughout: `src` and `build` are separate module graphs,
// and the router and the view have to be the same one
const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: createRouterView } =
  await import('../build/router/createRouterView/index.js');
const { default: param } = await import('../build/router/param/index.js');
const { default: navigate } = await import('../build/router/navigate/index.js');
const { default: selectParams } =
  await import('../build/router/selectParams/index.js');
const { default: getValue } = await import('../build/core/getValue/index.js');
const { default: watchValue } =
  await import('../build/core/watchValue/index.js');

const paths = {
  home: createPath(),
  shop: createPath('shop', {
    list: createPath('list'),
    item: createPath(
      'item',
      param({
        id: { parse: (v: string) => Number(v), stringify: String },
      })
    ),
  }),
};

const router = createRouter(paths);

const rendered: string[] = [];

const leaf = (name: string) => () => {
  rendered.push(name);

  return h('span', null, name);
};

const Home = leaf('home');

const List = leaf('list');

const Item = () => {
  const { id } = getValue(selectParams(router.routes.shop.item)) as {
    id: number;
  };

  rendered.push(`item:${id}`);

  return h('span', null, `item:${id}`);
};

/** Renders its children, and says every time it is rendered itself. */
const Shop = (props: any) => {
  rendered.push('shop-layout');

  return h('div', { id: 'shop' }, props.children);
};

const View = createRouterView([
  [router.routes.home, Home],
  [
    Shop,
    [
      [router.routes.shop.list, List],
      [router.routes.shop.item, Item],
    ],
  ],
]);

const go = async (to: any) => {
  await act(async () => {
    navigate(to);
  });
};

test('the view renders the matched page, and only the slots that changed', async () => {
  assert.equal(
    getValue(router.routes.home),
    true,
    'the root is where it opens'
  );

  const app = await mount(h(View, null));

  assert.equal(app.container.textContent, 'home');
  assert.deepEqual(rendered, ['home']);

  rendered.length = 0;

  await go(router.navigation.shop().list());

  assert.equal(app.container.textContent, 'list');
  assert.deepEqual(
    rendered,
    ['shop-layout', 'list'],
    'the layout is entered for the first time'
  );

  rendered.length = 0;

  // switching pages under a shared layout: its slot did not change, so it is
  // not what rerenders
  await go(router.navigation.shop().item({ id: 7 }));

  assert.equal(app.container.textContent, 'item:7');
  assert.deepEqual(rendered, ['item:7'], 'the layout stayed put');

  rendered.length = 0;

  await go(router.navigation.home());

  assert.equal(app.container.textContent, 'home');
  assert.deepEqual(rendered, ['home']);

  await app.unmount();
});

test('the params of a page outlive it by a task, then go', async () => {
  const app = await mount(h(View, null));

  await go(router.navigation.shop().item({ id: 3 }));

  assert.equal(app.container.textContent, 'item:3');

  const seen: unknown[] = [];

  const unwatch = watchValue(
    selectParams(router.routes.shop.item),
    (params: any) => {
      seen.push(params);
    }
  );

  // the page's own watches are still subscribed while it is torn down, so
  // nothing may hand them the params of a page on its way out
  await go(router.navigation.home());

  assert.equal(app.container.textContent, 'home');
  assert.deepEqual(seen, [], 'nothing was told while it was leaving');

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(seen, [undefined], 'and a task later they are gone');

  unwatch();

  await app.unmount();
});

test('hiding the view is not leaving the page, so its params stay', async () => {
  const app = await mount(
    h(Activity as any, { mode: 'visible' }, h(View, null))
  );

  await go(router.navigation.shop().item({ id: 5 }));

  assert.equal(app.container.textContent, 'item:5');

  const seen: unknown[] = [];

  const unwatch = watchValue(
    selectParams(router.routes.shop.item),
    (params: any) => {
      seen.push(params);
    }
  );

  // hiding tears the page's effects down with the route still matched - what
  // the page is showing is what it comes back to
  await app.render(h(Activity as any, { mode: 'hidden' }, h(View, null)));

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(seen, [], 'hiding told the page nothing');
  assert.deepEqual(getValue(selectParams(router.routes.shop.item)), { id: 5 });

  unwatch();

  rendered.length = 0;

  // showing it again mounts the effects back without a render of its own -
  // nothing about the tree changed while it was away
  await app.render(h(Activity as any, { mode: 'visible' }, h(View, null)));

  assert.equal(app.container.textContent, 'item:5', 'and it is still there');
  assert.deepEqual(rendered, []);

  await app.unmount();
});

test('a watch the page itself opened hears nothing of the page leaving', async () => {
  const seen: unknown[] = [];

  // React destroys the passive effects of a deleted subtree parent-first, so
  // this one is still subscribed while the slot above it is being torn down
  const Watching = () => {
    useEffect(
      () =>
        watchValue(selectParams(router.routes.shop.item), (params: any) => {
          seen.push(params);
        }),
      []
    );

    return h('span', null, 'watching');
  };

  const WatchView = createRouterView([
    [router.routes.home, Home],
    [router.routes.shop.item, Watching],
  ]);

  // whatever the test before it left matched
  await go(router.navigation.home());

  const app = await mount(h(WatchView, null));

  await go(router.navigation.shop().item({ id: 9 }));

  assert.equal(app.container.textContent, 'watching');
  assert.deepEqual(seen, [], 'the match itself is not a change for it');

  await go(router.navigation.home());

  assert.deepEqual(seen, [], 'and neither is the page going away');

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(seen, [], 'by the time they are cleared it is long gone');

  await app.unmount();
});
