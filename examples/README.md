# Examples

Each folder is a standalone app. Read one on its own, or copy it out - nothing is
shared between them, so an example's import list is the complete story of what it
depends on.

They are ordered. `01` assumes nothing; `12` assumes the rest.

```bash
pnpm install               # once, from this folder
cd 01-counter && pnpm dev
```

The library is symlinked in as `link:../../build`, so build it once from the repo
root (`npm run build`); after that a rebuild is picked up without reinstalling.

Each example declares only what it imports - `controlla`, `react`, `react-dom` -
and takes the versions from the `catalog:` in `pnpm-workspace.yaml`. The build
tooling lives in this folder's `devDependencies`, so there is one copy of vite
and one of TypeScript for all twelve. `pnpm -r typecheck` and `pnpm -r build`
run the lot.

## Controls

| | | |
|---|---|---|
| **01** | [counter](01-counter) | The smallest thing there is. `createPrimitiveControl`, `useValue`, `setValue`, and reading without subscribing. |
| **02** | [nested-control](02-nested-control) | Why nested paths matter: `$profile.contact.email` is its own control. Render counters show that writing one field leaves the others alone - including when you replace a whole subtree. |
| **03** | [derived](03-derived) | `createDerivedControl` recomputes on source changes and dedupes on the result. A cart total that moves constantly, next to a free-shipping message that only changes when it flips. |

## Async

| | | |
|---|---|---|
| **04** | [async-control](04-async-control) | A value that fetches itself. Suspending and non-suspending reads of the same control, `selectLoading`/`selectReady`/`selectError`, `invalidate` loud and silent, `toPromise`. |
| **05** | [registry](05-registry) | One control per key, created on demand and cached. `.get(key)` versus `.bind($control)`, and `retain` for prefetching. Includes a live tally of requests actually made. |
| **06** | [polling](06-polling) | Data that is not finished when the first response arrives. `pollLoader` with `isLoaded`, plus `syncedKeysCount` so every stage of one pipeline shares a clock, and `pause`/`resume`/`reset`. |

## Around the edges

| | | |
|---|---|---|
| **07** | [persistence](07-persistence) | Controls backed by `localStorage` and `sessionStorage`, shared across tabs, with `isValid` as the version guard against a stale shape. |
| **08** | [scheduling](08-scheduling) | When a write commits. Debounce, throttle, manual apply/cancel, `syncScheduler`, and `batch`. Counts commits rather than calls, so the difference is visible. |
| **09** | [dom](09-dom) | `mediaQuery`, `$windowSize`, `$pageVisible`, and `$online` - which is an *async* control, so being offline reads as "not ready" and a component can suspend on it. |

## Router

| | | |
|---|---|---|
| **10** | [router](10-router) | The URL as state. A typed path tree, params and query params as controls, nested routes, `Link`, `navigate`, `NOT_FOUND` - and blocking navigation on a page with unsaved edits. |
| **11** | [router-anchors](11-router-anchors) | The section you are reading, in the URL. Deliberately tall sections, because a scroll spy needs a page that scrolls. Shows why writing the anchor and scrolling to it are *not* symmetric. |

## Everything together

| | | |
|---|---|---|
| **12** | [job-board](12-job-board) | A small multi-page app: per-page `bound.ts` deriving route params into registry binds, a detail page assembled from sections that load and fail independently, a search whose filters live in the URL, and a persisted saved-list. The only example with more than one file per page. |

## Reading order, if you only want three

`01-counter` for the shape of a control, `05-registry` for how server data works,
`12-job-board` for how it looks at scale.
