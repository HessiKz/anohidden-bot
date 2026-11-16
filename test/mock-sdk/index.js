// mock-sdk/index.js — the test double for the virtual `sdk` module.
//
// `import { db, api, InputFile, BotApiError, EndpointError, ... } from 'sdk'`
// resolves here via test/loader.mjs. Everything from `sdk/db` is re-exported
// so both import styles from the docs work:
//   import { db, api } from 'sdk'
//   import { eq, sql } from 'sdk/db'

export * from './db.js';
export { default as db } from './db.js';

export {
  api,
  BotApiError,
  InputFile,
  EndpointError,
  FormData,
  fetch,
  __state,
  __resetApi,
  __getApiState,
  __setBlockedChat,
} from './api.js';

import { db } from './db.js';
import { api } from './api.js';
import * as apiMod from './api.js';

// Default export: the whole SDK surface as one object, for `import sdk from 'sdk'`.
export default { db, api, ...apiMod };
