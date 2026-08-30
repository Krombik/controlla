import { defineConfig } from 'tsdown';
import fs from 'fs/promises';
import { join, relative } from 'path';
import { transform } from 'esbuild';

/**
 * One cache per target, shared across every chunk of every format of it, so
 * `_field` mangles to the same name everywhere (chunks exchange objects at
 * runtime). Targets build in parallel and ship separately - sharing one
 * across them would just be two writers on the same object.
 *
 * Nothing else is minified: the names a reader came for are the ones this
 * leaves alone.
 */
const _makeMangleInternals = () => {
  const mangleCache: Record<string, string | false> = {};

  // one chunk at a time: two of them starting from the same cache would hand
  // the same field two different names
  let queue: Promise<unknown> = Promise.resolve();

  return {
    name: 'mangle-internals',
    renderChunk(code: string, chunk: { fileName: string }) {
      if (!/\.c?js$/.test(chunk.fileName)) {
        return null;
      }

      const mangled = queue
        .then(() =>
          transform(code, {
            // covers `o._x`, `o['_x']` and `'_x' in o`
            mangleProps: /^_/,
            mangleQuoted: true,
            mangleCache,
            sourcemap: true,
          })
        )
        .then((result) => {
          Object.assign(mangleCache, result.mangleCache);

          return { code: result.code, map: result.map };
        });

      queue = mangled;

      return mangled;
    },
  };
};

const _filesToCopy = ['LICENSE', 'README.md'];

const _pickFrom = (obj: Record<string, any>, keys: string[]) =>
  keys.reduce<Record<string, any>>(
    (acc, key) => (obj[key] != null ? { ...acc, [key]: obj[key] } : acc),
    {}
  );

const _toRoot = (path: string) => `./${path}`;

const _getFile = (path: string, name: string, ext: string) =>
  _toRoot(join(path, `./${name}.${ext}`));

const _getIndexFile = (path: string, ext: string) =>
  _getFile(path, 'index', ext);

type _Module = { types: string; default?: string };

type _Export = { require: _Module; import: _Module };

type _Exports = Record<string, _Export>;

const _getExport = (path: string): _Exports => ({
  [path]: {
    require: {
      types: _getIndexFile(path, 'd.cts'),
      default: _getIndexFile(path, 'cjs'),
    },
    import: {
      types: _getIndexFile(path, 'd.ts'),
      default: _getIndexFile(path, 'js'),
    },
  },
});

const _emptyTypesFiles = [
  'types.js',
  'types.js.map',
  'types.cjs',
  'types.cjs.map',
];

/**
 * A `types.ts` entry is declarations-only: drop the empty runtime files
 * tsdown emits for it and export just the `types` conditions.
 */
const _getTypesExport = async (folderPath: string, path: string) => {
  for (let i = 0; i < _emptyTypesFiles.length; i++) {
    await fs.rm(join(folderPath, _emptyTypesFiles[i]), { force: true });
  }

  return {
    [_toRoot(join(path, 'types'))]: {
      require: { types: _getFile(path, 'types', 'd.cts') },
      import: { types: _getFile(path, 'types', 'd.ts') },
    },
  } as _Exports;
};

const _exists = (path: string) =>
  fs.access(path).then(
    () => true,
    () => false
  );

const _getExports = async (outDir: string, path: string, obj: _Exports) => {
  const dirs = await fs.readdir(path);

  for (let i = 0; i < dirs.length; i++) {
    const folderPath = `${path}/${dirs[i]}`;

    if ((await fs.lstat(folderPath)).isDirectory()) {
      const folderRoot = _toRoot(relative(outDir, folderPath));

      obj = {
        ...obj,
        // chunk folders have no index — only real entry points are exported
        ...((await _exists(join(folderPath, 'index.js')))
          ? _getExport(folderRoot)
          : undefined),
        // domain-level type modules (core/types, router/types, …)
        ...((await _exists(join(folderPath, 'types.d.ts')))
          ? await _getTypesExport(folderPath, folderRoot)
          : undefined),
        ...(await _getExports(outDir, folderPath, obj)),
      };
    }
  }

  return obj;
};

/** Modules with no native counterpart - out of the native entries and barrel. */
const _webOnly = new Set([
  'form/NativeField',
  'form/useNativeField',
  'persist/safeLocalStorage',
  'persist/safeSessionStorage',
  'platform/mediaQuery',
  'platform/online',
  // there is no viewport to scroll: what scrolls in a native app is a view,
  // and which one is the app's business, not the router's
  'router/anchor',
  'router/trackScroll',
  'router/registerAnchor',
  'router/registerAnchorOffset',
  'router/selectAnchor',
  'router/selectRegisteredAnchors',
  // the entry stack is the router's own, so no foreign entry can appear in it
  'router/repairHistory',
]);

/** Modules with no web counterpart - out of the web entries and barrel. */
const _nativeOnly = new Set([
  // the address bar is the only source of a url there is on the web
  'router/withPrefixes',
  // ...and it is read before anything renders, so nothing there ever waits
  'router/routerReady',
]);

/** Public names that aren't the folder name - a control reads better with the `$`. */
const _publicNames: Record<string, string> = {
  'core/never': '$never',
  'platform/appVisible': '$appVisible',
  'platform/online': '$online',
  'platform/windowSize': '$windowSize',
  'router/navigationState': '$navigationState',
  'router/routerReady': '$routerReady',
};

type _SrcModule = {
  _id: string;
  _domain: string;
  _entry: string;
  _name: string;
};

/** Every module and domain-level `types.ts` under `src`, in readdir order. */
const _scanSrc = async () => {
  const modules: _SrcModule[] = [];

  const typeDomains: string[] = [];

  const domains = await fs.readdir('src');

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];

    const domainPath = `src/${domain}`;

    if (!(await fs.lstat(domainPath)).isDirectory()) {
      continue;
    }

    if (await _exists(`${domainPath}/types.ts`)) {
      typeDomains.push(domain);
    }

    const names = await fs.readdir(domainPath);

    for (let j = 0; j < names.length; j++) {
      const name = names[j];

      const modulePath = `${domainPath}/${name}`;

      if (name == '_internal' || !(await fs.lstat(modulePath)).isDirectory()) {
        continue;
      }

      for (const index of ['index.ts', 'index.tsx']) {
        const entry = `${modulePath}/${index}`;

        if (await _exists(entry)) {
          const id = `${domain}/${name}`;

          modules.push({
            _id: id,
            _domain: domain,
            _entry: entry,
            _name: _publicNames[id] || name,
          });
        }
      }
    }
  }

  return { modules, typeDomains };
};

/**
 * The barrel is generated rather than checked in: what the native build
 * exports is a subset, and an `export` can't be conditional.
 */
const _writeBarrel = async (
  path: string,
  modules: _SrcModule[],
  typeDomains: string[]
) => {
  const lines = typeDomains.map(
    (domain) => `export type * from './${domain}/types';`
  );

  let domain = '';

  for (let i = 0; i < modules.length; i++) {
    const module = modules[i];

    if (module._domain !== domain) {
      domain = module._domain;

      lines.push('');
    }

    lines.push(`export { default as ${module._name} } from './${module._id}';`);
  }

  await fs.writeFile(path, `${lines.join('\n')}\n`);
};

const { modules: _modules, typeDomains: _typeDomains } = await _scanSrc();

/**
 * Object form, because the barrel differs per target - the `/index` suffix is
 * what keeps a module at `<domain>/<name>/index.js` rather than a flat file.
 */
const _getEntry = async (native: boolean) => {
  const excluded = native ? _webOnly : _nativeOnly;

  const included = _modules.filter((module) => !excluded.has(module._id));

  const barrel = `src/index${native ? '.native' : ''}.ts`;

  await _writeBarrel(barrel, included, _typeDomains);

  const entry: Record<string, string> = { index: barrel };

  for (let i = 0; i < _typeDomains.length; i++) {
    entry[`${_typeDomains[i]}/types`] = `src/${_typeDomains[i]}/types.ts`;
  }

  for (let i = 0; i < included.length; i++) {
    entry[`${included[i]._id}/index`] = included[i]._entry;
  }

  return entry;
};

/** Carried over from the root package.json as-is — version included, so both ship in lockstep. */
const _inheritedFields = [
  'version',
  'author',
  'keywords',
  'repository',
  'license',
  'bugs',
  'homepage',
  'type',
  'peerDependencies',
  'peerDependenciesMeta',
  'dependencies',
  'engines',
];

const _writePackageJson = async (
  outDir: string,
  overrides: Record<string, any>
) => {
  await fs.writeFile(
    `${outDir}/package.json`,
    JSON.stringify(
      {
        ..._pickFrom(
          JSON.parse((await fs.readFile('package.json')).toString()),
          ['name', 'description', ..._inheritedFields]
        ),
        ...overrides,
        publishConfig: { access: 'public' },
        main: _getIndexFile('./', 'cjs'),
        module: _getIndexFile('./', 'js'),
        types: _getIndexFile('./', 'd.ts'),
        exports: {
          './package.json': './package.json',
          ...(await _getExports(outDir, outDir, _getExport('.'))),
        },
        sideEffects: false,
      },
      undefined,
      2
    )
  );

  for (let i = 0; i < _filesToCopy.length; i++) {
    await fs.copyFile(_filesToCopy[i], `${outDir}/${_filesToCopy[i]}`);
  }
};

/**
 * Two packages out of one source: `__NATIVE__` is substituted at build time,
 * so the branch not taken is dropped along with everything only it reaches.
 * Separate directories — a nested one would ship the web build inside the
 * native package.
 */
const _targets = [
  {
    _outDir: 'build',
    _native: false,
    _tsconfig: 'tsconfig.json',
    _overrides: {},
  },
  {
    _outDir: 'build-native',
    _native: true,
    // the flag is a literal per target, so what the types say narrows with it
    _tsconfig: 'tsconfig.native.json',
    _overrides: {
      name: 'controlla-native',
      peerDependencies: {
        '@types/react': '>=18.0.0',
        react: '>=18.0.0',
        // named capture groups and `AppState.addEventListener` returning a
        // subscription both land here
        'react-native': '>=0.71.0',
      },
      description:
        'Fine-grained reactive state and fully typed router for React Native - async, derived, persisted and keyed controls with surgical re-renders',
    },
  },
];

export default defineConfig(
  await Promise.all(
    _targets.map(async ({ _outDir, _native, _tsconfig, _overrides }) => ({
      entry: await _getEntry(_native),
      tsconfig: _tsconfig,
      // the types that differ between the two live here, one folder each
      alias: {
        '~platform': `${process.cwd()}/src/_platform/${_native ? 'native' : 'web'}`,
      },
      format: ['esm', 'cjs'] as ['esm', 'cjs'],
      outDir: _outDir,
      clean: true,
      sourcemap: true,
      // not `browser`: that one substitutes `process.env.NODE_ENV` in the esm
      // output, baking the dev branches in. `neutral` leaves the check for the
      // app's own bundler to resolve
      platform: 'neutral' as const,
      target: 'es2021',
      treeshake: {
        // what the package already claims with `sideEffects: false`, said to
        // rolldown as well: without it a bare `import` of an external it
        // cannot prove pure - `react-native` - lands in the web bundle, and a
        // module reached only from a dead branch is kept for its own sake
        moduleSideEffects: false,
      },
      deps: { neverBundle: ['react-native'] },
      dts: true,
      define: { __NATIVE__: `${_native}` },
      plugins: [_makeMangleInternals()],
      // We generate package.json (and its exports) ourselves in build:done.
      exports: false,
      hooks: {
        'build:done': () => _writePackageJson(_outDir, _overrides),
      },
    }))
  )
);
