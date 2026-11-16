// test/loader.mjs — module-resolution hook that maps the platform's virtual
// `sdk` modules onto the local mock. Register with test/setup.mjs.
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = fileURLToPath(import.meta.url);
const INDEX = pathToFileURL(`${here}/../mock-sdk/index.js`).href;
const DB = pathToFileURL(`${here}/../mock-sdk/db.js`).href;

const MAP = {
  sdk: INDEX,
  'sdk/db': DB,
  // Submodules documented by the SDK resolve to the same mock surface.
  'sdk/api': INDEX,
  'sdk/fetch': INDEX,
};

export function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(MAP, specifier)) {
    return { shortCircuit: true, url: MAP[specifier] };
  }
  return nextResolve(specifier, context);
}
