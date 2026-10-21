// Test-process adapter: exercise real server services in Node without Next's build-time import sentinel.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Node's CommonJS test preload.
const Module = require('node:module');
const original = Module._load;
Module._load = function (name, ...args) {
  return name === 'server-only' ? {} : original.call(this, name, ...args);
};
