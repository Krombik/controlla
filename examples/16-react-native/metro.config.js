const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// the library is linked in from outside this workspace
config.watchFolders = [path.resolve(projectRoot, '../../build-native')];

// ...and has no node_modules of its own, so react and react-native are resolved
// from here rather than from whatever is above the link - two copies of either
// is two registries, and hooks stop working
const PINNED = new Set(['react', 'react-dom', 'react-native']);

config.resolver.resolveRequest = (context, moduleName, platform) =>
  context.resolveRequest(
    PINNED.has(moduleName.split('/')[0])
      ? { ...context, originModulePath: path.join(projectRoot, 'index.ts') }
      : context,
    moduleName,
    platform
  );

module.exports = config;
