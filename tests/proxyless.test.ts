// the env module must come first: it installs the browser mocks
import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';

// what an app's bundler defines and the guard in `createScope` reads, once,
// when it loads - hence the dynamic imports below
(globalThis as any).__CONTROLLA_PROXYLESS__ = true;

const { default: createControl } =
  await import('../build/core/createControl/index.js');
const { default: getValue } = await import('../build/core/getValue/index.js');
const { default: setValue } = await import('../build/core/setValue/index.js');
const { default: watchValue } =
  await import('../build/core/watchValue/index.js');
const { default: $never } = await import('../build/core/never/index.js');
const { default: selectLoading } =
  await import('../build/core/selectLoading/index.js');

const profile = () => ({
  contact: { name: 'dana', email: 'dana@example.com' },
  tags: ['ts'],
});

test('no proxy stands in for property access', () => {
  const $profile: any = createControl(profile());

  assert.equal($profile.contact, undefined, 'a plain object, nothing trapped');
  assert.equal(typeof $profile.a, 'function');
});

test('a() walks the same tree property access would have', () => {
  const $profile: any = createControl(profile());

  assert.equal(getValue($profile.a('contact').a('name')), 'dana');
  assert.deepEqual(getValue($profile.a('contact')), profile().contact);
  assert.equal(getValue($profile.a('tags').a('0')), 'ts');
  assert.equal(getValue($profile.a('contact').a('missing')), undefined);
});

test('the same path answers with the same control', () => {
  const $profile: any = createControl(profile());

  assert.equal($profile.a('contact'), $profile.a('contact'));
  assert.equal(
    $profile.a('contact').a('name'),
    $profile.a('contact').a('name')
  );
});

test('a leaf reached through a() is a control of its own', async () => {
  const $profile: any = createControl(profile());

  const $name = $profile.a('contact').a('name');

  const seen: string[] = [];

  watchValue($name, (value: any) => {
    seen.push(value);
  });

  setValue($name, 'jane');

  await tick();

  assert.deepEqual(seen, ['jane']);
  assert.equal((getValue($profile) as any).contact.name, 'jane');
  assert.equal(
    getValue($profile.a('contact').a('email')),
    'dana@example.com',
    'the sibling is untouched'
  );
});

test('$never answers a() with itself, however deep', () => {
  const $any: any = $never;

  assert.equal($any.a('profile'), $any);
  assert.equal($any.a('profile').a('name'), $any);
  assert.equal(getValue($any.a('profile').a('name')), undefined);
  assert.equal(
    getValue(selectLoading($any.a('profile'))),
    true,
    'a path of it is loading forever too'
  );
});
