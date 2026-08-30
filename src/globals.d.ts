/**
 * `true` in the React Native build, `false` in the web one — replaced at build
 * time, so the branch not taken is dropped along with everything only it reaches.
 * What the two builds differ in by *type* is under `src/_platform` instead: a
 * flag narrows no declaration a build emits.
 */
declare const __NATIVE__: boolean;
