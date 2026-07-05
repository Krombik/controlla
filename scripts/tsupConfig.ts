import { defineConfig } from 'tsup';
import fs from 'fs/promises';
import { join, relative, parse } from 'path';
import { PACKAGE_PATH, SHARED, SRC_PATH, UTILS } from './constants';
import YAML from 'yaml';

const _filesToCopy = ['../../LICENSE', 'README.md'];

const _CHUNKS = '_chunks';

const _pickFrom = (obj: Record<string, any>, keys: string[]) =>
  keys.reduce<Record<string, any>>(
    (acc, key) => (obj[key] != null ? { ...acc, [key]: obj[key] } : acc),
    {}
  );

const _toRoot = (path: string) => `./${path}`;

const _getIndexFile = (path: string, ext: string) =>
  _toRoot(join(path, `./index.${ext}`));

type _Module = {
  types: string;
  default: string;
};

type _Export = {
  require: _Module;
  import: _Module;
};

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

const _getExports = async (path: string) => {
  const dirs = await fs.readdir(path);

  let obj: _Exports = {};

  for (let i = 0; i < dirs.length; i++) {
    const folder = dirs[i];

    if (folder != _CHUNKS && folder != SHARED) {
      const folderPath = `${path}/${folder}`;

      if ((await fs.lstat(folderPath)).isDirectory()) {
        obj = {
          ...obj,
          ..._getExport(_toRoot(relative(outDir, folderPath))),
        };
      }
    }
  }

  return obj;
};

const getShared = async () => {
  const pathToFolder = `${outDir}/${SHARED}`;

  try {
    await fs.access(pathToFolder, fs.constants.F_OK);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return {};
    }

    throw err;
  }

  const files = await fs.readdir(pathToFolder);

  const obj: _Exports = {};

  files.forEach((file) => {
    const { name, ext } = parse(file);

    const path = `./${SHARED}/${name}`;

    if (ext == '.cjs') {
      obj[path] = {
        require: {
          types: `${path}.d.cts`,
          default: `${path}.cjs`,
        },
        import: {
          types: `${path}.d.ts`,
          default: `${path}.js`,
        },
      };
    }
  });

  return obj;
};

const outDir = 'build';

const MANGLE_CACHE_PATH = '../../.cache/mangle.json';

const INITIAL_MANGLE_CACHE: Record<string, string | false> = JSON.parse(
  await fs.readFile(MANGLE_CACHE_PATH, 'utf8')
);

let nextMangleCache = INITIAL_MANGLE_CACHE;

export default defineConfig((prevOptions) => ({
  ignoreWatch: [outDir],
  watch: prevOptions.watch,
  outDir,
  minify: false,
  entry: [
    `${SRC_PATH}/index.ts`,
    `${SRC_PATH}/types.ts`,
    `${SRC_PATH}/${SHARED}/*.ts`,
    `${SRC_PATH}/!(${SHARED}|${UTILS})/index.ts`,
  ],
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  treeshake: { preset: 'smallest' },
  cjsInterop: true,
  dts: true,
  format: ['cjs', 'esm'],
  platform: 'browser',
  esbuildOptions: (options) => {
    options.chunkNames = `${_CHUNKS}/[name]-[hash]`;

    options.mangleQuoted = true;

    options.mangleProps = /^_/;

    options.mangleCache = INITIAL_MANGLE_CACHE;
  },
  esbuildPlugins: [
    {
      name: 'persist-mangle-cache',
      setup(build) {
        build.onEnd((result) => {
          nextMangleCache = result.mangleCache!;
        });
      },
    },
  ],
  async onSuccess() {
    const mangledKeys = Object.keys(nextMangleCache);

    if (
      Object.keys(INITIAL_MANGLE_CACHE).length !== mangledKeys.length ||
      mangledKeys.some(
        (key) => nextMangleCache[key] !== INITIAL_MANGLE_CACHE[key]
      )
    ) {
      await fs.writeFile(
        MANGLE_CACHE_PATH,
        JSON.stringify(nextMangleCache, null, 2)
      );
    }

    const { catalog } = YAML.parse(
      await fs.readFile('../../pnpm-workspace.yaml', 'utf8')
    );

    const packageJSON = JSON.parse(await fs.readFile(PACKAGE_PATH, 'utf8'));

    const { dependencies } = packageJSON;

    for (const key in dependencies) {
      if (dependencies[key] === 'catalog:') {
        dependencies[key] = catalog[key];
      }
    }

    await fs.writeFile(
      `${outDir}/package.json`,
      JSON.stringify(
        {
          ..._pickFrom(packageJSON, [
            'name',
            'version',
            'author',
            'description',
            'keywords',
            'repository',
            'license',
            'bugs',
            'homepage',
            'peerDependencies',
            'peerDependenciesMeta',
            'dependencies',
            'engines',
          ]),
          publishConfig: {
            access: 'public',
          },
          main: _getIndexFile('./', 'cjs'),
          module: _getIndexFile('./', 'js'),
          types: _getIndexFile('./', 'd.ts'),
          exports: {
            [PACKAGE_PATH]: PACKAGE_PATH,
            ..._getExport('.'),
            './types': {
              require: {
                types: './types.d.cts',
              },
              import: {
                types: './types.d.ts',
              },
            },
            ...(await getShared()),
            ...(await _getExports(outDir)),
          },
          sideEffects: false,
        },
        null,
        2
      )
    );

    await fs.rm(`${outDir}/types.cjs`);
    await fs.rm(`${outDir}/types.cjs.map`);
    await fs.rm(`${outDir}/types.js`);
    await fs.rm(`${outDir}/types.js.map`);

    for (let i = 0; i < _filesToCopy.length; i++) {
      const pathToFile = _filesToCopy[i];

      const { name, ext } = parse(pathToFile);

      await fs.copyFile(pathToFile, `${outDir}/${name}${ext}`);
    }
  },
}));
