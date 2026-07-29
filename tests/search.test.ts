// the env module must come first: it installs the browser mocks
import { location } from './_env/browser.ts';
import assert from 'node:assert';

// A malformed percent-escape is reachable from any pasted or crawled url, and
// the search string is read while the router is being created - an unguarded
// `decodeURIComponent` there takes the whole app down before it boots.
location.pathname = '/catalog';
location.search = '?q=100%&sort=a%20b';

const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: query } = await import('../build/router/query/index.js');
const { default: selectParams } =
  await import('../build/router/selectParams/index.js');
import getValue from '../build/core/getValue/index.js';

const router = createRouter({
  catalog: createPath('catalog', query({ q: true, sort: true })),
});

assert.deepEqual(
  getValue(selectParams(router.routes.catalog)),
  { q: '100%', sort: 'a b' },
  'a malformed escape keeps its raw text, a valid one still decodes'
);

console.log('search.test.ts: all assertions passed');
