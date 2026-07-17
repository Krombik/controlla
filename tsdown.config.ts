import { defineConfig } from 'tsdown';
import fs from 'fs/promises';
import { join, relative } from 'path';

const outDir = 'build';

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

/**
 * A `types.ts` entry is declarations-only: drop the empty runtime files
 * tsdown emits for it and export just the `types` conditions.
 */
const _getTypesExport = async (folderPath: string, path: string) => {
  for (const file of [
    'types.js',
    'types.js.map',
    'types.cjs',
    'types.cjs.map',
  ]) {
    await fs.rm(join(folderPath, file), { force: true });
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

const _getExports = async (path: string, obj: _Exports) => {
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
        ...(await _getExports(folderPath, obj)),
      };
    }
  }

  return obj;
};

const _getEntries = async () => {
  const entries = ['src/index.ts'];

  const domains = await fs.readdir('src');

  for (let i = 0; i < domains.length; i++) {
    const domainPath = `src/${domains[i]}`;

    if (!(await fs.lstat(domainPath)).isDirectory()) {
      continue;
    }

    if (await _exists(`${domainPath}/types.ts`)) {
      entries.push(`${domainPath}/types.ts`);
    }

    const modules = await fs.readdir(domainPath);

    for (let j = 0; j < modules.length; j++) {
      const modulePath = `${domainPath}/${modules[j]}`;

      if (
        modules[j] != '_internal' &&
        (await fs.lstat(modulePath)).isDirectory()
      ) {
        for (const index of ['index.ts', 'index.tsx']) {
          if (await _exists(`${modulePath}/${index}`)) {
            entries.push(`${modulePath}/${index}`);
          }
        }
      }
    }
  }

  return entries;
};

export default defineConfig({
  entry: await _getEntries(),
  format: ['esm', 'cjs'],
  outDir,
  clean: true,
  sourcemap: true,
  platform: 'browser',
  target: 'es2020',
  treeshake: true,
  dts: true,
  // We generate package.json (and its exports) ourselves in build:done.
  exports: false,
  hooks: {
    async 'build:done'() {
      await fs.writeFile(
        `${outDir}/package.json`,
        JSON.stringify(
          {
            ..._pickFrom(
              JSON.parse((await fs.readFile('package.json')).toString()),
              [
                'name',
                'version',
                'author',
                'description',
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
              ]
            ),
            publishConfig: { access: 'public' },
            main: _getIndexFile('./', 'cjs'),
            module: _getIndexFile('./', 'js'),
            types: _getIndexFile('./', 'd.ts'),
            exports: {
              './package.json': './package.json',
              ...(await _getExports(outDir, _getExport('.'))),
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
    },
  },
});
