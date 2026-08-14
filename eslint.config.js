import tseslint from 'typescript-eslint';

/** Domains with private internals; core's `_internal` (#internal/*) is shared. */
const nonCoreDomains = ['router', 'persist', 'scheduler', 'dom'];

/**
 * `syncScheduler` is the flush contract core already owns (`Scheduler._sync`)
 * with a body of `cb()` — core commits through it, so it is exempt.
 */
const coreAllowed = ['syncScheduler'];

const boundaries = [
  // core is the foundation — it must not depend on any non-core domain at all
  {
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: nonCoreDomains.map((domain) => ({
            group: [
              `\\#${domain}/**`,
              `**/${domain}/**`,
              ...coreAllowed.map((name) => `!**/${name}`),
            ],
            message: `core must not depend on ${domain} — invert the dependency or move shared code to src/core.`,
          })),
        },
      ],
    },
  },
  // non-core domains must not use each other's internals
  ...nonCoreDomains.map((domain) => ({
    files: [`src/${domain}/**`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: nonCoreDomains
            .filter((other) => other !== domain)
            .map((other) => ({
              group: [`\\#${other}/internal/*`, `**/${other}/_internal/*`],
              message: `${domain} must not use ${other} internals — move the util to src/core/_internal (#internal/*) if it must be shared.`,
            })),
        },
      ],
    },
  })),
];

export default tseslint.config(
  {
    ignores: ['build/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
    },
  },
  ...boundaries
);
