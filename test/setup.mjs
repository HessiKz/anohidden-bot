// test/setup.mjs — import this FIRST (before anything that imports `sdk`)
// so the resolution hook is in place for the whole module graph.
import { register } from 'node:module';

register('./loader.mjs', import.meta.url);
