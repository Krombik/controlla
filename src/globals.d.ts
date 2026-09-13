/**
 * `true` in the React Native build, `false` in the web one — replaced at build
 * time, so the branch not taken is dropped along with everything only it reaches.
 * What the two builds differ in by *type* is under `src/_platform` instead: a
 * flag narrows no declaration a build emits.
 */
declare const __NATIVE__: boolean;

/**
 * `true` where a build plugin rewrote every scope access into `a('key')` calls,
 * so the proxy is dead weight. The *app's* bundler defines it, not this one -
 * hence the `typeof` guard around it: a free identifier is also the one thing
 * rolldown won't fold, and a folded one takes the branch the plugin exists to
 * reach with it. Left undefined, the proxy is what stands there.
 */
declare const __CONTROLLA_PROXYLESS__: boolean;
