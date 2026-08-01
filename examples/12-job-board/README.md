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
| Async registry | [`src/pages/Registry.tsx`](src/pages/Registry.tsx) | `createRegistry` + `requestLoader`: one control per key, fetched on first use, deduped, cached. Suspending and non-suspending reads of the same control, `invalidate`, `retain` for prefetch, and a real error path. |
| Listing page | [`src/pages/Listing/`](src/pages/Listing) | A detail page assembled from sections that load, skeleton and fail independently - plus anchors, so the section you are reading is in the URL. The closest thing here to a real page. |
| Search | [`src/pages/Search/`](src/pages/Search) | The URL *is* the state. Filters are query params; a debounce scheduler keeps typing out of both history and the network; results come from a poll because the backend answers partially first. |
| Saved | [`src/pages/Saved.tsx`](src/pages/Saved.tsx) | A control backed by `localStorage` and observed across tabs, with everything else on the page derived from it. |

## How it is laid out

```
src/
  api.ts              stand-in backend: sleeps, can fail, searches in two rounds
  router.ts           every URL the app has, and the type of every param in it
  App.tsx             the shell - createRouterView maps routes to pages
  controls/listings.ts   the registries (server-backed state)
  components/NavLink.tsx wraps the headless Link once
  pages/              one example each
```

Two conventions worth copying:

**State lives outside React.** Controls are module-level. URL-backed ones are
declared in `router.ts`, server-backed ones in `controls/`. Pages only read and
write them - there is no provider, no context and no store to set up.

**Pages that need several controls declare them in a `bound.ts`.** See
[`src/pages/Listing/bound.ts`](src/pages/Listing/bound.ts): it derives the id
from the route and binds the registries to it once, so every section imports a
control that already follows the current URL. Nothing is threaded through props
and no effect re-runs a fetch.

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
