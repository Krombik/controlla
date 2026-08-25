// the env module must come first: it installs a real DOM before React loads
import { act, createElement as h, mount } from './_env/react.ts';
import assert from 'node:assert';
import test from 'node:test';

// the built modules throughout: `src` and `build` are separate module graphs,
// and the router and the link have to be the same one
const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: param } = await import('../build/router/param/index.js');
const { default: useLink } = await import('../build/router/useLink/index.js');
const { default: navigate } = await import('../build/router/navigate/index.js');
const { default: getValue } = await import('../build/core/getValue/index.js');

const router = createRouter({
  home: createPath(),
  shop: createPath('shop', {
    item: createPath('item', param({ id: false })),
  }),
});

const nav = router.navigation as any;

const go = async (to: any) => {
  await act(async () => {
    navigate(to);
  });
};

test('a click navigates, and the ones the browser owns are left alone', async () => {
  const App = () => {
    const link = useLink({ to: nav.shop().item({ id: '7' }) });

    return h('a', { href: link.href, onClick: link.onClick }, 'item');
  };

  const app = await mount(h(App, null));

  const anchor = app.container.firstChild as any;

  assert.equal(anchor.getAttribute('href'), '/shop/item/7');

  const click = (init: Record<string, unknown>) =>
    act(async () => {
      anchor.dispatchEvent(
        new anchor.ownerDocument.defaultView.MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ...init,
        })
      );
    });

  await click({ metaKey: true });

  assert.equal(
    getValue(router.routes.shop.item),
    false,
    'cmd-click is the browser opening a tab'
  );

  await click({ button: 1 });

  assert.equal(
    getValue(router.routes.shop.item),
    false,
    'so is a middle click'
  );

  await click({});

  assert.equal(
    getValue(router.routes.shop.item),
    true,
    'a plain one navigates'
  );

  await app.unmount();

  await go(nav.home());
});

test('the target may be a route chain of any depth', async () => {
  let deep = false;

  const Nav = () => {
    const { href } = useLink({
      to: deep ? nav.shop().item({ id: '3' }) : nav.home(),
    });

    return h('a', { href }, 'x');
  };

  const app = await mount(h(Nav, null));

  assert.equal((app.container.firstChild as any).getAttribute('href'), '/');

  deep = true;

  // one hook per route of the chain, and the rest of the slots are filled
  await app.render(h(Nav, null));

  assert.equal(
    (app.container.firstChild as any).getAttribute('href'),
    '/shop/item/3'
  );

  deep = false;

  await app.render(h(Nav, null));

  assert.equal((app.container.firstChild as any).getAttribute('href'), '/');

  await app.unmount();
});
