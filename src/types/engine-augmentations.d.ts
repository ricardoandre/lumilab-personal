// Pulls the engine's next-auth augmentation (Session/User gain id, isAdmin and
// impersonatedBy) into THIS app's compile program.
//
// A `declare module` applies only to programs that include the .d.ts, and
// TypeScript will not follow one across a package boundary by itself. Listing
// the path under tsconfig "include" does not work either: "exclude":
// ["node_modules"] filters it straight back out. A triple-slash reference is
// resolved directly and ignores both, which is why it is used here.
/// <reference path="../../node_modules/@lumilab/engine/src/types/next-auth.d.ts" />
export {};
