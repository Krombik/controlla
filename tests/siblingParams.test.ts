// the env module must come first: it installs the browser mocks
import { location, entries, tick } from './_env/browser.ts';
import assert from 'node:assert';
import test from 'node:test';

// a deep link straight onto the route declared *after* the one with the param
entries.length = 0;
entries.push({ url: '/search?q=go', state: { idx: 0 } });
location.pathname = '/search';
location.search = '?q=go';

const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: param } = await import('../build/router/param/index.js');
const { default: query } = await import('../build/router/query/index.js');
const { default: getValue } = await import('../build/core/getValue/index.js');
const { default: selectParams } =
  await import('../build/router/selectParams/index.js');

const router = createRouter({
  item: createPath('item', param({ id: false }), {
    reviews: createPath('reviews'),
  }),
  search: createPath('search', query({ q: true })),
});

const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

await settle();

test('a route declared after one with a path param matches on its own', () => {
  assert.equal(
    getValue(router.routes.search),
    true,
    'the path params of a sibling are not this route’s to read'
  );

  assert.deepEqual(getValue(selectParams(router.routes.search) as any), {
    q: 'go',
  });
});

test('while a child still inherits the path params above it', async () => {
  const { default: navigate } =
    await import('../build/router/navigate/index.js');

  navigate((router.navigation as any).item({ id: '42' }).reviews());

  await settle();

  assert.equal(getValue(router.routes.item.reviews), true);

  assert.deepEqual(getValue(selectParams(router.routes.item) as any), {
    id: '42',
  });
});
