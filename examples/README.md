# Examples

Each folder is a standalone app. Read one on its own, or copy it out - nothing is
shared between them, so an example's import list is the complete story of what it
depends on.

They are ordered by what they assume: `01` assumes nothing, `12` assumes
everything before it, and `13` to `15` each pick up one part of the API on their
own again.

```bash
pnpm install               # once, from this folder
cd 01-counter && pnpm dev
```

The library is symlinked in as `link:../../build`, so build it once from the repo
root (`npm run build`); after that a rebuild is picked up without reinstalling.

Each example declares only what it imports - `controlla`, `react`, `react-dom` -
and takes the versions from the `catalog:` in `pnpm-workspace.yaml`. The build
tooling lives in this folder's `devDependencies`, so there is one copy of vite
and one of TypeScript for all fifteen. `pnpm -r typecheck` and `pnpm -r build`
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
| **05** | [registry](05-registry) | One control per key, created on demand and cached. `.get(key)` versus `createBoundControl(registry, $control)`, and `keepPrev` so switching keys does not flash a fallback. Includes a live tally of requests actually made. |
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
| **12** | [job-board](12-job-board) | A small multi-page app: prefetching declared next to the router so it runs before React does, a detail page whose bag scopes its bound controls to the page, sections that load and fail independently, a search whose filters live in the URL, and a persisted saved-list. The only example with more than one file per page. |

## The rest of the API

| | | |
|---|---|---|
| **13** | [controls-context](13-controls-context) | Three lifetimes for a control: module scope, a `createControlsContext` bag built per mounted provider, and a `useControl` tree that dies with its component. Two panels of the same declarations, sharing one registry and nothing else. |
| **14** | [forms](14-forms) | The form module. `useForm` over a control it does not own, fields wired both ways (`useNativeField` and the `NativeField`/`Field` components), rules with their own triggers, a path validator finding duplicate rows, `useFieldArray`, and a submit that reports only what moved. |
| **15** | [infinite-list](15-infinite-list) | `useInfiniteValues` and `useBoundControl` - a list of controls whose *length* changes between renders, which is the one thing the other read hooks cannot do. Pages that load out of order, and a strip of individually bound rows. |

## Where state lives

One rule runs through all of these. **Module scope is for what is genuinely one
per app**: registries and async controls with a loader (so a `retain` can warm
them before anything renders), the router's params, the DOM controls, a control
backed by storage. A control at module scope is one value for every visitor,
which on a server is one value for every request at once.

**Everything else is a bag or a hook** - `createControlsContext` when more than
one component needs it, `useControl`/`usePrimitiveControl` when one component
owns it. Reading never changes between them; where a control is declared decides
only who can see it and how long it lives.

`13-controls-context` is the example about that choice. `12-job-board` shows it
at scale: registries and URL params at module level, a bag per page for what
should leave with the page, and `src/preloads.ts` starting the loads before React
renders.

## Reading order, if you only want three

`01-counter` for the shape of a control, `05-registry` for how server data works,
`12-job-board` for how it looks at scale.
