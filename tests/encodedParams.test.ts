// the env module must come first: it installs the browser mocks
import { location, entries, history, tick } from './_env/browser.ts';
import assert from 'node:assert';
import test from 'node:test';

entries.length = 0;
entries.push({ url: '/city/m%C3%BCnchen/tags/a%20b/c', state: { idx: 0 } });
location.pathname = '/city/m%C3%BCnchen/tags/a%20b/c';
location.search = '?q=caf%C3%A9';
location.hash = '#%C3%BCberblick';

const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: param } = await import('../build/router/param/index.js');
const { default: query } = await import('../build/router/query/index.js');
const { default: arrayParam } =
  await import('../build/router/arrayParam/index.js');
const { default: navigate } = await import('../build/router/navigate/index.js');
const { default: oneOf } = await import('../build/router/oneOf/index.js');
const { default: anchor } = await import('../build/router/anchor/index.js');
const { default: selectAnchor } =
  await import('../build/router/selectAnchor/index.js');
const { default: getValue } = await import('../build/core/getValue/index.js');
const { default: selectParams } =
  await import('../build/router/selectParams/index.js');

const router = createRouter({
  city: createPath(
    'city',
    param({ name: false }),
    'tags',
    arrayParam({ tags: false }),
    query({ q: true }),
    anchor()
  ),
  orders: createPath(
    'orders',
    oneOf({ region: { variants: ['süd', 'nord'] } })
  ),
  tag: createPath('tag', param({ v: false })),
});

const params = selectParams(router.routes.city) as any;

const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

await settle();

test('a url is unescaped on the way in, path params included', () => {
  assert.deepEqual(
    getValue(params),
    { name: 'münchen', tags: ['a b', 'c'], q: 'café' },
    'what the address bar escaped comes back as it was written'
  );

  assert.equal(
    getValue(selectAnchor(router.routes.city) as any),
    'überblick',
    'the anchor of the url too'
  );
});

test('and a navigation to the same value reads the same', async () => {
  navigate(
    (router.navigation as any).city({
      name: 'san josé',
      tags: ['x y'],
      q: 'ü',
    })
  );

  await settle();

  const written = getValue(params);

  history.go(-1);

  await settle();

  history.go(1);

  await settle();

  assert.deepEqual(
    getValue(params),
    written,
    'a pop back onto the entry parses what the write put there'
  );

  assert.deepEqual(written, { name: 'san josé', tags: ['x y'], q: 'ü' });
});

test('a malformed escape is kept as it is, not thrown on', async () => {
  // straight into the address bar, as a paste or a crawler would
  entries.push({ url: '/city/100%/tags/a', state: { idx: entries.length } });

  history.go(1);

  await settle();

  assert.equal((getValue(params) as any).name, '100%');
});

test('a variant that is not ascii still matches its own url', async () => {
  navigate((router.navigation as any).orders({ region: 'süd' }));

  await settle();

  assert.equal(location.pathname, '/orders/s%C3%BCd', 'escaped on the way out');

  assert.equal(
    (getValue(selectParams(router.routes.orders) as any) as any).region,
    'süd',
    'and back as it was declared'
  );
});

test('what would end the path is escaped into it', async () => {
  navigate((router.navigation as any).tag({ v: 'a#b?c' }));

  await settle();

  assert.equal(location.pathname, '/tag/a%23b%3Fc', 'still one segment');
  assert.equal(location.hash, '', 'nothing spilled into the hash');
  assert.equal(location.search, '', 'nor into the query');

  // and the url alone is enough to get it back, as a reload would
  history.go(-1);

  await settle();

  history.go(1);

  await settle();

  assert.equal(
    (getValue(selectParams(router.routes.tag) as any) as any).v,
    'a#b?c'
  );
});
