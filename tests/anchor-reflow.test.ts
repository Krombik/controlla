// the env module must come first: it installs the browser mocks
import {
  listeners,
  location,
  entries,
  tick,
  windowMock,
  fakeElement,
  setScrollHeight,
} from './_env/browser.ts';
import assert from 'node:assert';

// A smooth anchor scroll that a reflow cuts short: a section swapped for
// skeletons shrinks the page, the scroll position clamps, and the browser calls
// the smooth scroll finished. The spy is no longer suppressed, reads a page that
// is now bottomed out, and crowns the last section. The aim is re-applied once
// the page fills back in - so it has to re-announce its target, and suppress the
// spy again along with it, or the wrong section keeps the highlight.
entries.length = 0;
entries.push({ url: '/page', state: { idx: 0 } });
location.pathname = '/page';
location.search = '';
location.hash = '';

const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: anchor } = await import('../build/router/anchor/index.js');
const { default: trackScroll } =
  await import('../build/router/trackScroll/index.js');
const { default: registerAnchor } =
  await import('../build/router/registerAnchor/index.js');
const { default: navigate } = await import('../build/router/navigate/index.js');
const { default: selectRegisteredAnchors } =
  await import('../build/router/selectRegisteredAnchors/index.js');
import getValue from '../build/core/getValue/index.js';

windowMock.onScroll = () => {};

const router = createRouter({
  page: createPath(
    'page',
    trackScroll(
      anchor<'intro' | 'rooms' | 'faq'>(() => ({ behavior: 'smooth' }))
    )
  ),
});

const rects: Record<string, { top: number }> = {
  intro: { top: 0 },
  rooms: { top: 900 },
  faq: { top: 1600 },
};

for (const id of ['intro', 'rooms', 'faq'] as const) {
  registerAnchor(router.routes.page, id).ref(
    fakeElement({ rect: () => rects[id] })
  );
}

const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

const registered = () => getValue(selectRegisteredAnchors(router.routes.page));

const fire = (type: string) => {
  for (const fn of listeners[type] || []) fn({});
};

await settle();

navigate(router.navigation.page('rooms'));
await settle();

assert.equal(
  registered().rooms,
  'active',
  'the aimed section is the active one'
);

// the sections became skeletons: a shorter page, clamped to its bottom
rects.intro = { top: -400 };
rects.rooms = { top: -100 };
rects.faq = { top: 60 };
windowMock.scrollY = 100;
setScrollHeight(900);
await settle();

// which is what ends the smooth scroll, as far as the browser is concerned
fire('scrollend');
fire('scroll');
await settle();

// the page fills back in and the aim is applied again, to where the section
// actually is now
rects.rooms = { top: 0 };
rects.faq = { top: 700 };
setScrollHeight(2000);
await settle();

assert.equal(
  registered().rooms,
  'active',
  're-aimed: the target takes the highlight back'
);
assert.equal(registered().faq, true, 're-aimed: the last section is demoted');

// and the re-applied scroll is suppressed like the first one was: what the page
// looks like mid-flight is not what is being read
rects.rooms = { top: -900 };
rects.faq = { top: -100 };

fire('scroll');
await settle();

assert.equal(
  registered().rooms,
  'active',
  're-aimed: the spy stays out of it until the scroll ends'
);

fire('scrollend');
fire('scroll');
await settle();

assert.equal(registered().faq, 'active', 'the spy resumes once it does end');

console.log('anchor-reflow.test.ts: all assertions passed');
