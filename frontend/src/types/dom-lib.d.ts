// Some toolchains can end up typechecking without the DOM lib typings,
// which makes globals like `window`/`document` appear as missing or empty interfaces.
// This file forces DOM lib types to be available for the project typecheck.
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

export {};

