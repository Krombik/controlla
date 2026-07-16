// eslint tooling still needs the JS compiler (TS 6) — the project itself uses
// native TS 7. Rewire @typescript-eslint's `typescript` peer to a bundled TS 6:
// https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0
module.exports = {
  hooks: {
    readPackage(pkg) {
      if (
        pkg.name &&
        pkg.name.startsWith('@typescript-eslint/') &&
        pkg.peerDependencies &&
        pkg.peerDependencies.typescript
      ) {
        delete pkg.peerDependencies.typescript;

        pkg.dependencies = {
          ...pkg.dependencies,
          typescript: 'npm:typescript@^6.0.3',
        };
      }

      return pkg;
    },
  },
};
