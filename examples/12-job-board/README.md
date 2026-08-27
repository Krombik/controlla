# controlla examples

A small job board. Five pages, each one self-contained: read its file top to
bottom and it stands on its own.

```bash
npm install
npm run dev
```

The app depends on `file:../build`, so build the library first (`npm run build`
in the repo root) and rebuild it after changing library source.

## The examples

| Page | File | What it shows |
|---|---|---|
| Local state | [`src/pages/FormState.tsx`](src/pages/FormState.tsx) | `createControl` with nested paths. Render counters prove a write to one field leaves its siblings alone. No async, no router. |
| Async registry | [`src/pages/Registry.tsx`](src/pages/Registry.tsx) | `createRegistry` + `requestLoader`: one control per key, fetched on first use, deduped, cached. Suspending and non-suspending reads of the same control, `invalidate` loud and silent, and a real error path. |
| Listing page | [`src/pages/Listing/`](src/pages/Listing) | A detail page assembled from sections that load, skeleton and fail independently - plus anchors, so the section you are reading is in the URL, and a bag so its controls leave with it. The closest thing here to a real page. |
| Search | [`src/pages/Search/`](src/pages/Search) | The URL *is* the state. Filters are query params; a debounce scheduler keeps typing out of both history and the network; results come from a poll because the backend answers partially first. |
| Saved | [`src/pages/Saved.tsx`](src/pages/Saved.tsx) | A control backed by `localStorage` and observed across tabs, with everything else on the page derived from it. |

## How it is laid out

```
src/
  api.ts              stand-in backend: sleeps, can fail, searches in two rounds
  router.ts           every URL the app has, and the type of every param in it
  preloads.ts         what starts loading before React does
  App.tsx             the shell - createRouterView maps routes to pages
  controls/listings.ts   the registries (server-backed state)
  components/NavLink.tsx wraps the headless Link once
  pages/              one example each
```

Three conventions worth copying:

**State lives outside React.** Controls are module-level by default: URL-backed
ones in `router.ts`, server-backed ones in `controls/`. Pages only read and write
them, so there is no store to set up. A page whose controls should not outlive it
puts them in a bag instead - see the listing page.

**Prefetching lives next to the router, not on a page.**
[`src/preloads.ts`](src/preloads.ts) watches a route's params with `watchValue`
and `retain`s what the next click will want, handing the release back as the
watcher's cleanup. It is imported by `main.tsx`, so those requests are in flight
as soon as the script is parsed - before React renders, and without waiting on
the rest of the bundle. A module-level watcher is exactly right here and almost
nowhere else; anything tied to a mounted component belongs in an effect.

**Pages that need several controls declare them in a `controls.ts`.** Two shapes
of that, on purpose. [`src/pages/Search/controls.ts`](src/pages/Search/controls.ts)
is module-level, because everything in it is the URL or derived from it and the
URL outlives any mount. [`src/pages/Listing/controls.ts`](src/pages/Listing/controls.ts)
is a `createControlsContext` bag, so its bound controls are built when the page
mounts and let go of their registry items when it goes. Either way a section
imports a control that already follows the current URL - nothing is threaded
through props and no effect re-runs a fetch.

## Partial use

Every import is a subpath (`controlla/core/useValue`, not `controlla`), so each
file's import list is the complete story of what it depends on. `FormState.tsx`
never touches the router or the loaders and does not pull them in;
`Saved.tsx` never touches Suspense. That is the point of reading the files
individually - you can take one pattern without adopting the rest.

## What is deliberately not here

`api.ts` is not an example of anything - it is a fake so the app runs with no
server. Its two-round search exists only to give the polling example something
honest to poll.
