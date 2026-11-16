// mock-sdk/db.js — local test double for the platform's virtual `sdk/db` module.
//
// This is TEST-ONLY code. It mirrors the documented behaviour of the tgcloud
// SDK database (see /home/docs/tgcloud-sdk.md) on top of `node:sqlite`'s
// DatabaseSync. It implements what the project uses plus the documented
// surface; anything else throws a clear error instead of returning wrong data.
//
// Subtleties mirrored from the real runtime:
//  - every DB call is async (builders are awaitable, terminals return Promises)
//  - no foreign keys: .references() and foreignKey() throw at declaration
//  - .deprecated() columns are invisible at runtime (excluded from DDL + rows)
//  - table-bound builders convert modes (boolean/json/timestamp/bytes);
//    raw db.run/all/get/values do NOT convert — raw wire values come back
//  - `sql` templates bind values as ?-params; column refs become identifiers;
//    in DDL contexts (DEFAULT/CHECK/GENERATED) everything is inlined as literals

import { DatabaseSync } from 'node:sqlite';
import { rmSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

const DEFAULT_DB_PATH = process.env.ANON_TEST_DB || '/tmp/opencode/anon-test.sqlite';

let _db = null;
let _dbPath = DEFAULT_DB_PATH;

function conn() {
  if (!_db) _db = new DatabaseSync(_dbPath);
  return _db;
}

function stmt(sqlText) {
  return conn().prepare(sqlText);
}

function failToBind(value, col) {
  return new Error(
    `mock-sdk/db: cannot bind value ${typeof value} (${String(value)})${
      col ? ` for column ${col.name}` : ''
    } — convert booleans/Dates via column modes before raw SQL`
  );
}

// Close and delete the SQLite file (and WAL/SHM sidecars), then recreate it.
function reset(path = _dbPath) {
  if (_db) {
    _db.close();
    _db = null;
  }
  _dbPath = path;
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      rmSync(path + suffix, { force: true });
    } catch {
      /* file may not exist yet */
    }
  }
  // Recreate an empty file eagerly so tests can inspect the path.
  conn().exec('SELECT 1');
  return path;
}

/** Raw escape hatch for tests: the underlying DatabaseSync instance. */
export function __getSqlite() {
  return conn();
}

/** Test helper: close + delete + recreate the database file. */
export function __resetDb(path) {
  return reset(path);
}

export function resetDatabase(path) {
  return reset(path);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function q(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function unsupported(what) {
  throw new Error(`mock-sdk/db: ${what} is not supported by the test harness`);
}

/** SQL literal rendering for DDL contexts (DEFAULT / CHECK / GENERATED). */
function literal(v) {
  if (v == null) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (v instanceof Date) return String(Math.floor(v.getTime() / 1000)); // timestamp (sec) is the common case
  if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
  if (v instanceof Uint8Array) return `X'${Buffer.from(v).toString('hex')}'`;
  throw failToBind(v);
}

// ---------------------------------------------------------------------------
// sql tagged template
// ---------------------------------------------------------------------------

// A sql node: { kind:'sql', strings, items }. Items are raw JS values (params),
// Column refs (identifiers), nested sql nodes, or {kind:'sql-raw'} splices.
export function sql(strings, ...items) {
  return { kind: 'sql', strings, items };
}

/** `sql.raw('literal SQL')` — inserted verbatim, never parameterized. */
sql.raw = function raw(text) {
  return { kind: 'sql-raw', text: String(text) };
};

function isColumnRef(x) {
  return x && typeof x === 'object' && x.kind === 'column';
}

/**
 * Compile a sql node (or sql-raw) into { text, params }.
 * ctx.mode 'param'  → values become `?` params (query context)
 * ctx.mode 'literal'→ values are inlined as SQL literals (DDL context)
 */
function compileSqlNode(node, ctx) {
  if (node.kind === 'sql-raw') return { text: node.text, params: [] };
  let text = '';
  for (let i = 0; i < node.strings.length; i++) {
    text += node.strings[i];
    if (i < node.items.length) {
      const item = node.items[i];
      if (isColumnRef(item)) {
        if (!item.name) unsupported('column ref without a SQL name');
        text += q(item.name);
      } else if (item && (item.kind === 'sql' || item.kind === 'sql-raw')) {
        // Nested sql splices its text; its params were already pushed into ctx.
        const sub = compileSqlNode(item, ctx);
        text += sub.text;
      } else if (item === undefined) {
        throw new Error('mock-sdk/db: sql template got undefined — use null explicitly');
      } else if (ctx.mode === 'literal') {
        text += literal(item);
      } else {
        ctx.params.push(item);
        text += '?';
      }
    }
  }
  // ctx is shared across nested splices; all params live there.
  return { text, params: ctx.params };
}

// ---------------------------------------------------------------------------
// Column descriptors
// ---------------------------------------------------------------------------

const TYPE_NAME = { text: 'TEXT', integer: 'INTEGER', real: 'REAL', numeric: 'NUMERIC', blob: 'BLOB' };
// STRICT tables only accept INT/INTEGER/REAL/TEXT/BLOB/ANY — numeric → ANY.
const TYPE_NAME_STRICT = { text: 'TEXT', integer: 'INTEGER', real: 'REAL', numeric: 'ANY', blob: 'BLOB' };

class Column {
  constructor(type, name, opts = {}) {
    this.kind = 'column';
    this.type = type;
    this.name = name ?? null;
    this.mode = opts.mode ?? null;
    this.o = { ...opts };
  }

  _clone(over = {}) {
    const c = new Column(this.type, this.name, { ...this.o, ...over });
    c.mode = over.mode ?? this.mode;
    return c;
  }

  primaryKey(opt = true) {
    const c = this._clone();
    c.o.primaryKey = opt;
    if (opt && typeof opt === 'object') c.o.autoIncrement = !!opt.autoIncrement;
    return c;
  }

  notNull() {
    return this._clone({ notNull: true });
  }

  unique() {
    return this._clone({ unique: true });
  }

  default(v) {
    return this._clone({ default: v });
  }

  generatedAlwaysAs(expr, opts = {}) {
    return this._clone({ generated: expr, generatedMode: opts.mode ?? 'virtual' });
  }

  /** Arbitrary column-level DDL, e.g. `.constraint('COLLATE NOCASE')`. */
  constraint(ddl) {
    return this._clone({ constraint: ddl });
  }

  /** Terminal: marks the column for drop; invisible at runtime. */
  deprecated(reason) {
    const c = this._clone({ deprecated: reason ?? true });
    return c;
  }

  /** Documented to throw — the runtime runs with FKs off. */
  references() {
    throw new Error(
      "mock-sdk/db: .references() is not supported — the platform runs SQLite with foreign keys disabled. Enforce integrity in application code."
    );
  }
}

export function text(name, opts) {
  return new Column('text', name, { mode: opts?.mode, ...opts });
}
export function integer(name, opts) {
  return new Column('integer', name, opts);
}
export function real(name, opts) {
  return new Column('real', name, opts);
}
export function float(name, opts) {
  return new Column('real', name, opts);
}
export function numeric(name, opts) {
  return new Column('numeric', name, opts);
}
export function blob(name, opts) {
  return new Column('blob', name, { ...opts, mode: opts?.mode ?? 'bytes' });
}
export function boolean(name, opts) {
  return new Column('integer', name, { ...opts, mode: 'boolean' });
}
export function json(name, opts) {
  return new Column('text', name, { ...opts, mode: 'json' });
}

// ---------------------------------------------------------------------------
// Table-level constraint / index builders
// ---------------------------------------------------------------------------

class IndexBuilder {
  constructor({ kind, name, unique = false }) {
    this.kind = kind; // 'index' | 'unique'
    this.name = name;
    this.unique = unique;
    this.refs = null;
    this.whereExpr = null;
  }
  on(...refs) {
    const b = Object.create(this);
    b.refs = refs;
    return b;
  }
  where(expr) {
    const b = Object.create(this);
    b.whereExpr = expr;
    return b;
  }
}

export function index(name) {
  return new IndexBuilder({ kind: 'index', name });
}
export function uniqueIndex(name) {
  return new IndexBuilder({ kind: 'index', name, unique: true });
}
export function unique(name) {
  return new IndexBuilder({ kind: 'unique', name });
}
export function primaryKey(opts) {
  return { kind: 'pk', refs: opts?.columns ?? [] };
}
export function check(name, expr) {
  return { kind: 'check', name, expr };
}

/** NOT supported — throws at declaration, like the real SDK. */
export function foreignKey() {
  throw new Error(
    'mock-sdk/db: foreignKey() is not supported — the platform runs SQLite with foreign keys disabled. Enforce integrity in application code.'
  );
}

// ---------------------------------------------------------------------------
// Table descriptors
// ---------------------------------------------------------------------------

class Table {
  constructor(name, columns) {
    this.kind = 'table';
    this.name = name;
    this.cols = columns; // { jsKey: Column }
    this.extras = [];    // index/unique/pk/check descriptors
    this._strict = false;
    this._withoutRowid = false;
    this._extraConstraints = []; // raw DDL strings from .constraint()
    this._deprecatedReason = null;
  }

  /** column ref access: table.cols.userId; tables themselves are the `t` maps */
  ref(jsKey) {
    return this.cols[jsKey];
  }

  _clone() {
    const t = Object.create(Table.prototype);
    Object.assign(t, this);
    // Shallow-copy mutable containers so modifiers don't mutate the original.
    t.cols = { ...this.cols };
    t.extras = [...this.extras];
    t._extraConstraints = [...this._extraConstraints];
    return t;
  }

  strict() {
    const t = this._clone();
    t._strict = true;
    return t;
  }

  withoutRowid() {
    const t = this._clone();
    t._withoutRowid = true;
    return t;
  }

  /** Raw table-level DDL, e.g. `.constraint('CHECK (x > 0)', 'chk_x')`. */
  constraint(ddl, name) {
    const t = this._clone();
    t._extraConstraints.push({ ddl: String(ddl), name });
    return t;
  }

  /** Terminal: table scheduled for drop — skipped by fresh schema creation. */
  deprecated(reason) {
    const t = this._clone();
    t._deprecatedReason = reason ?? true;
    return t;
  }
}

export function table(name, columns, extra) {
  // Columns may be declared unnamed (name taken from the JS key). Each table
  // owns a distinct clone so refs used in index extras match these objects.
  const cols = {};
  for (const [key, col] of Object.entries(columns)) {
    if (!(col instanceof Column)) {
      throw new Error(`mock-sdk/db: table ${name}.${key} is not a column descriptor`);
    }
    const c = col._clone();
    if (!c.name) c.name = key;
    cols[key] = c;
  }
  const t = new Table(name, cols);
  if (extra) {
    const extras = extra(cols); // `t` maps JS keys → column refs
    t.extras = Object.values(extras);
  }
  // Production code accesses columns directly (`users.tgId`, `messages.senderId`).
  // Enumerable + writable so Table._clone() (Object.assign) preserves them.
  for (const [key, col] of Object.entries(cols)) {
    Object.defineProperty(t, key, { value: col, enumerable: true, configurable: true, writable: true });
  }
  return t;
}

// ---------------------------------------------------------------------------
// Operators (conditions, aggregates, ordering)
// ---------------------------------------------------------------------------

const CMP = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };

function op(kind, left, right) {
  return { kind: 'op', op: kind, left, right };
}
export const eq = (a, b) => op('eq', a, b);
export const ne = (a, b) => op('ne', a, b);
export const gt = (a, b) => op('gt', a, b);
export const gte = (a, b) => op('gte', a, b);
export const lt = (a, b) => op('lt', a, b);
export const lte = (a, b) => op('lte', a, b);

export function like(a, b) {
  return { kind: 'like', left: a, right: b, negated: false };
}
export function notLike(a, b) {
  return { kind: 'like', left: a, right: b, negated: true };
}

export function isNull(a) {
  return { kind: 'isNull', left: a, negated: false };
}
export function isNotNull(a) {
  return { kind: 'isNull', left: a, negated: true };
}

export function and(...conds) {
  const list = conds.filter((c) => c != null);
  if (list.length === 0) return null;
  return list.length === 1 ? list[0] : { kind: 'logical', op: 'AND', conds: list };
}
export function or(...conds) {
  const list = conds.filter((c) => c != null);
  if (list.length === 0) return null;
  return list.length === 1 ? list[0] : { kind: 'logical', op: 'OR', conds: list };
}
export function not(cond) {
  return { kind: 'not', cond };
}

export function between(a, lo, hi) {
  return { kind: 'between', left: a, lo, hi, negated: false };
}
export function notBetween(a, lo, hi) {
  return { kind: 'between', left: a, lo, hi, negated: true };
}

export function inArray(a, values) {
  return { kind: 'inArray', left: a, values: values ?? [], negated: false };
}
export function notInArray(a, values) {
  return { kind: 'inArray', left: a, values: values ?? [], negated: true };
}

// Aggregates: usable in projections / having / orderBy.
export function count(x) {
  return { kind: 'fn', fn: 'count', arg: x ?? sql.raw('*') };
}
export function sum(x) {
  return { kind: 'fn', fn: 'sum', arg: x };
}
export function avg(x) {
  return { kind: 'fn', fn: 'avg', arg: x };
}
export function min(x) {
  return { kind: 'fn', fn: 'min', arg: x };
}
export function max(x) {
  return { kind: 'fn', fn: 'max', arg: x };
}

export function asc(x) {
  return { kind: 'order', expr: x, dir: 'ASC' };
}
export function desc(x) {
  return { kind: 'order', expr: x, dir: 'DESC' };
}

// ---------------------------------------------------------------------------
// Mode conversion (table-bound builders only)
// ---------------------------------------------------------------------------

/** JS value → SQLite bind value, honouring the column's mode. */
function toWire(col, v) {
  if (v === undefined) return undefined; // caller decides (skip / default)
  if (v === null) return null;
  switch (col?.mode) {
    case 'boolean':
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'number') return v ? 1 : 0;
      throw failToBind(v, col);
    case 'json':
      if (typeof v === 'string') return v;
      if (typeof v === 'object' || typeof v === 'number' || typeof v === 'boolean') return JSON.stringify(v);
      throw failToBind(v, col);
    case 'timestamp':
      if (v instanceof Date) return Math.floor(v.getTime() / 1000);
      if (typeof v === 'number' || typeof v === 'bigint') return v;
      throw failToBind(v, col);
    case 'timestamp_ms':
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'number' || typeof v === 'bigint') return v;
      throw failToBind(v, col);
    case 'bytes': {
      if (v instanceof Uint8Array) return v;
      if (v instanceof ArrayBuffer) return new Uint8Array(v);
      if (v instanceof DataView) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
      throw failToBind(v, col);
    }
    default:
      if (typeof v === 'boolean') return v ? 1 : 0; // plain integer columns
      if (v instanceof Date) throw failToBind(v, col);
      return v;
  }
}

/** SQLite value → JS value, honouring the column's mode. */
function fromWire(col, v) {
  if (v == null) return null;
  switch (col?.mode) {
    case 'boolean':
      return v !== 0;
    case 'json':
      if (typeof v === 'string') return JSON.parse(v);
      return v;
    case 'timestamp':
      return new Date(Number(v) * 1000);
    case 'timestamp_ms':
      return new Date(Number(v));
    case 'bytes':
      return v instanceof Uint8Array ? v : new Uint8Array(v);
    default:
      return v;
  }
}

// ---------------------------------------------------------------------------
// Expression compilation
// ---------------------------------------------------------------------------

function compileExpr(e, ctx) {
  if (e == null) throw new Error('mock-sdk/db: undefined expression in query');
  if (isColumnRef(e)) {
    return { text: q(e.name), params: [] };
  }
  if (e.kind === 'sql' || e.kind === 'sql-raw') return compileSqlNode(e, ctx);
  if (e.kind === 'fn') {
    const arg = e.fn === 'count' && e.arg === undefined ? { kind: 'sql-raw', text: '*' } : e.arg;
    const a = compileExpr(arg, ctx);
    return { text: `${e.fn}(${a.text})`, params: a.params };
  }
  throw unsupported(`expression of kind ${e.kind}`);
}

/**
 * Compile a condition. Values are converted for the column's mode so that
 * e.g. gte(messages.createdAt, new Date()) binds unix seconds, and
 * eq(bannedUsers.active, true) binds 1.
 */
function compileCond(c, ctx) {
  if (c == null) return null;
  if (c.kind === 'sql' || c.kind === 'sql-raw') return compileSqlNode(c, ctx);
  if (c.kind === 'logical') {
    const parts = c.conds.map((x) => compileCond(x, ctx)).filter(Boolean);
    return { text: `(${parts.map((p) => p.text).join(` ${c.op} `)})`, params: parts.flatMap((p) => p.params) };
  }
  if (c.kind === 'not') {
    const inner = compileCond(c.cond, ctx);
    return { text: `(NOT ${inner.text})`, params: inner.params };
  }
  if (c.kind === 'op') {
    const l = compileExpr(c.left, ctx);
    // column-vs-column comparison
    if (isColumnRef(c.right)) {
      const r = compileExpr(c.right, ctx);
      return { text: `${l.text} ${CMP[c.op]} ${r.text}`, params: [...l.params, ...r.params] };
    }
    if (c.right && (c.right.kind === 'sql' || c.right.kind === 'sql-raw' || c.right.kind === 'fn')) {
      const r = compileExpr(c.right, ctx);
      return { text: `${l.text} ${CMP[c.op]} ${r.text}`, params: [...l.params, ...r.params] };
    }
    if (c.right === undefined) throw new Error('mock-sdk/db: comparison with undefined — use null explicitly');
    if (c.right === null) {
      const isNullSql = c.op === 'eq' ? 'IS NULL' : c.op === 'ne' ? 'IS NOT NULL' : null;
      if (isNullSql) return { text: `${l.text} ${isNullSql}`, params: l.params };
      throw new Error(`mock-sdk/db: ${c.op} null is not valid SQL`);
    }
    ctx.params.push(toWire(c.left.kind === 'column' ? c.left : null, c.right));
    return { text: `${l.text} ${CMP[c.op]} ?`, params: l.params };
  }
  if (c.kind === 'like') {
    const l = compileExpr(c.left, ctx);
    const wire = toWire(c.left.kind === 'column' ? c.left : null, c.right);
    ctx.params.push(wire);
    return { text: `${l.text} ${c.negated ? 'NOT LIKE' : 'LIKE'} ?`, params: l.params };
  }
  if (c.kind === 'isNull') {
    const l = compileExpr(c.left, ctx);
    return { text: `${l.text} ${c.negated ? 'IS NOT NULL' : 'IS NULL'}`, params: l.params };
  }
  if (c.kind === 'between') {
    const l = compileExpr(c.left, ctx);
    const col = c.left.kind === 'column' ? c.left : null;
    const lo = toWire(col, c.lo);
    const hi = toWire(col, c.hi);
    ctx.params.push(lo, hi);
    return { text: `${l.text} ${c.negated ? 'NOT BETWEEN' : 'BETWEEN'} ? AND ?`, params: l.params };
  }
  if (c.kind === 'inArray') {
    const l = compileExpr(c.left, ctx);
    const col = c.left.kind === 'column' ? c.left : null;
    if (!Array.isArray(c.values)) throw new Error('mock-sdk/db: inArray expects an array');
    if (c.values.length === 0) {
      // Empty IN lists: inArray → false, notInArray → true (drizzle parity).
      return { text: c.negated ? '1 = 1' : '1 = 0', params: [] };
    }
    const wires = c.values.map((v) => toWire(col, v));
    ctx.params.push(...wires);
    return {
      text: `${l.text} ${c.negated ? 'NOT IN' : 'IN'} (${wires.map(() => '?').join(', ')})`,
      params: l.params,
    };
  }
  throw unsupported(`condition of kind ${c.kind}`);
}

// ---------------------------------------------------------------------------
// Schema DDL generation + application
// ---------------------------------------------------------------------------

function columnDdl(col, strict = false) {
  const parts = [q(col.name), strict ? TYPE_NAME_STRICT[col.type] : TYPE_NAME[col.type]];
  if (col.o.primaryKey) {
    parts.push('PRIMARY KEY');
    if (col.o.autoIncrement) parts.push('AUTOINCREMENT');
  }
  if (col.o.unique) parts.push('UNIQUE');
  if (col.o.notNull) parts.push('NOT NULL');
  if (col.o.default !== undefined) {
    const d = col.o.default;
    const ddl = d && (d.kind === 'sql' || d.kind === 'sql-raw')
      ? compileSqlNode(d, { params: [], mode: 'literal' }).text
      : literal(defaultValue(col, d));
    parts.push(`DEFAULT ${ddl}`);
  }
  if (col.o.generated) {
    const ddl = compileSqlNode(col.o.generated, { params: [], mode: 'literal' }).text;
    parts.push(`AS (${ddl}) ${col.o.generatedMode === 'stored' ? 'STORED' : 'VIRTUAL'}`);
  }
  if (col.o.constraint) parts.push(String(col.o.constraint));
  return parts.join(' ');
}

// json column defaults are JSON-encoded; boolean defaults become 0/1.
function defaultValue(col, v) {
  if (col.mode === 'json' && v != null && typeof v !== 'string') return JSON.stringify(v);
  return v;
}

function indexDdl(t, e) {
  const cols = e.refs.map((r) => compileSqlNode(isColumnRef(r) ? sql`${r}` : r, { params: [], mode: 'literal' }).text);
  const where = e.whereExpr ? ` WHERE ${compileSqlNode(e.whereExpr, { params: [], mode: 'literal' }).text}` : '';
  const unique = e.unique ? 'UNIQUE ' : '';
  return `CREATE ${unique}INDEX ${q(e.name)} ON ${q(t.name)} (${cols.join(', ')})${where}`;
}

function tableDdl(t) {
  const cols = Object.values(t.cols)
    .filter((c) => !c.o.deprecated) // deprecated columns are invisible at runtime
    .map((c) => columnDdl(c, t._strict));

  const tableConstraints = [];
  for (const e of t.extras) {
    if (e.kind === 'pk') {
      tableConstraints.push(`PRIMARY KEY (${e.refs.map((r) => q(r.name)).join(', ')})`);
    } else if (e.kind === 'unique') {
      tableConstraints.push(`CONSTRAINT ${q(e.name)} UNIQUE (${e.refs.map((r) => q(r.name)).join(', ')})`);
    } else if (e.kind === 'check') {
      const ddl = compileSqlNode(e.expr, { params: [], mode: 'literal' }).text;
      tableConstraints.push(`CONSTRAINT ${q(e.name)} CHECK (${ddl})`);
    }
    // 'index' / 'index+unique' entries become separate CREATE INDEX statements
  }
  for (const c of t._extraConstraints) tableConstraints.push(c.ddl);

  const body = [...cols, ...tableConstraints].join(',\n  ');
  const suffix = [t._strict ? 'STRICT' : null, t._withoutRowid ? 'WITHOUT ROWID' : null].filter(Boolean).join(', ');
  return `CREATE TABLE ${q(t.name)} (\n  ${body}\n)${suffix ? ' ' + suffix : ''}`;
}

/**
 * Create every exported table of a schema module (dependency-free order —
 * the runtime has no FKs, so declaration order is fine).
 * Returns the list of table names created (deprecated tables are skipped).
 */
export function applySchema(schemaModule) {
  const created = [];
  const indexStatements = [];
  for (const value of Object.values(schemaModule)) {
    if (!(value instanceof Table)) continue;
    if (value._deprecatedReason) continue; // fresh creation skips deprecated tables
    conn().exec(tableDdl(value));
    created.push(value.name);
    for (const e of value.extras) {
      if (e instanceof IndexBuilder && e.refs && !e.refs.some((r) => isDeprecatedRef(value, r))) {
        indexStatements.push(indexDdl(value, e));
      }
    }
  }
  for (const s of indexStatements) conn().exec(s);
  return created;
}

function isDeprecatedRef(t, r) {
  if (!isColumnRef(r)) return false;
  for (const col of Object.values(t.cols)) {
    if (col === r && col.o.deprecated) return true;
  }
  return false;
}

/** Convenience: import the project schema and apply it. */
export async function createSchema(schemaPath = process.env.TG_SCHEMA_PATH || '/home/tgcloud/schema.js') {
  const mod = await import(schemaPath);
  return applySchema(mod);
}

// ---------------------------------------------------------------------------
// Raw SQL: db.run / db.all / db.get / db.values
// ---------------------------------------------------------------------------

// Convert `(queryString, {':name': v})` into positional ?-params, because
// node:sqlite's named-parameter support varies across Node versions.
// An array of positional params is passed through as-is.
function positionalize(text, paramsObj) {
  if (paramsObj == null) return { text, params: [] };
  if (Array.isArray(paramsObj)) return { text, params: paramsObj };
  const params = [];
  const sqlText = text.replace(/([:@$])([A-Za-z_][A-Za-z0-9_]*)/g, (whole, sigil, name) => {
    const key = `${sigil}${name}`;
    const bare = name;
    if (Object.prototype.hasOwnProperty.call(paramsObj, key)) {
      params.push(paramsObj[key]);
      return '?';
    }
    if (Object.prototype.hasOwnProperty.call(paramsObj, bare)) {
      params.push(paramsObj[bare]);
      return '?';
    }
    return whole; // leave unknown placeholders alone (e.g. inside literals)
  });
  return { text: sqlText, params };
}

function asQuery(q1, q2) {
  if (q1 && (q1.kind === 'sql' || q1.kind === 'sql-raw')) {
    if (q2 !== undefined) throw new Error('mock-sdk/db: a sql`…` query takes no second argument');
    const ctx = { params: [], mode: 'param' };
    const { text, params } = compileSqlNode(q1, ctx);
    return { text, params };
  }
  if (typeof q1 === 'string') return positionalize(q1, q2);
  throw new Error('mock-sdk/db: raw queries take sql`…` or (queryString, params)');
}

// node:sqlite's run() refuses statements that return rows; detect RETURNING.
const RETURNING_RE = /\bRETURNING\b/i;

function rawExec(kind, q1, q2) {
  const { text, params } = asQuery(q1, q2);
  if (kind === 'run' && RETURNING_RE.test(text)) {
    const rows = stmt(text).all(...params);
    const last = rows.length ? rows[rows.length - 1] : null;
    const lir =
      last && typeof last === 'object'
        ? Number(last.rowid ?? last.id ?? last.ID ?? 0) || 0
        : 0;
    return { rowsAffected: rows.length, lastInsertRowid: lir, rows };
  }
  if (kind === 'run') {
    const r = stmt(text).run(...params);
    return { rowsAffected: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid), rows: [] };
  }
  if (kind === 'all') return stmt(text).all(...params);
  if (kind === 'get') {
    const r = stmt(text).all(...params);
    return r.length ? r[0] : null;
  }
  if (kind === 'values') {
    const rows = stmt(text).all(...params);
    return rows.map((r) => Object.values(r));
  }
  throw unsupported(`raw method ${kind}`);
}

// ---------------------------------------------------------------------------
// Table-bound builders
// ---------------------------------------------------------------------------

// rows: SQLite objects → JS objects converted per the table's column modes.
function mapRows(t, rows, projection) {
  if (projection) return rows.map((r) => mapProjectionRow(r, projection));
  // SELECT * — map every non-deprecated column by its JS key
  const cols = Object.entries(t.cols).filter(([, c]) => !c.o.deprecated);
  return rows.map((r) => {
    const out = {};
    for (const [key, col] of cols) {
      if (r[col.name] === undefined) continue; // column not present (e.g. raw projection)
      out[key] = fromWire(col, r[col.name]);
    }
    return out;
  });
}

function mapProjectionRow(r, projection) {
  // Result keys are the projection aliases (SQLite keys RETURNING/SELECT
  // columns by their output name), so read by alias and convert by column.
  const out = {};
  for (const [alias, expr] of Object.entries(projection)) {
    const wire = r[alias];
    out[alias] = isColumnRef(expr) ? fromWire(expr, wire) : wire;
  }
  return out;
}

function returningCols(t, projection) {
  if (projection == null) return '*';
  return Object.entries(projection)
    .map(([alias, expr]) => {
      if (!isColumnRef(expr)) throw unsupported('returning projection with non-column expressions');
      return alias === expr.name ? q(expr.name) : `${q(expr.name)} AS ${q(alias)}`;
    })
    .join(', ');
}

function insertValues(t, valuesList) {
  // Column list = union of provided keys, in first-seen order, excluding
  // undefined values and deprecated columns.
  const deprecated = new Set(Object.values(t.cols).filter((c) => c.o.deprecated).map((c) => c.name));
  const colKeys = [];
  for (const v of valuesList) {
    for (const key of Object.keys(v)) {
      if (v[key] !== undefined && !colKeys.includes(key)) colKeys.push(key);
    }
  }
  const cols = colKeys.map((k) => t.cols[k]);
  for (const k of colKeys) {
    if (!t.cols[k]) throw new Error(`mock-sdk/db: insert into ${t.name} has unknown column ${k}`);
    if (t.cols[k].o.deprecated) throw new Error(`mock-sdk/db: cannot insert into deprecated column ${k}`);
  }
  const names = cols.map((c) => c.name);
  const rows = valuesList.map((v) => colKeys.map((k) => toWire(t.cols[k], v[k])));
  return { names, cols, rows };
}

class InsertBuilder {
  constructor(t) {
    this._t = t;
    this._values = null;
    this._conflict = null; // { action, target, set }
    this._returning = undefined; // undefined = run result; object/null = rows
  }
  values(v) {
    this._values = Array.isArray(v) ? v : [v];
    return this;
  }
  onConflictDoNothing(opt = {}) {
    this._conflict = { action: 'nothing', target: opt.target ?? null };
    return this;
  }
  onConflictDoUpdate(opt = {}) {
    if (!opt?.set || typeof opt.set !== 'object') throw new Error('mock-sdk/db: onConflictDoUpdate requires set');
    this._conflict = { action: 'update', target: opt.target ?? null, set: opt.set };
    return this;
  }
  returning(projection = null) {
    this._returning = projection;
    return this;
  }
  _sql(ctx) {
    const t = this._t;
    if (!this._values || this._values.length === 0) throw new Error('mock-sdk/db: insert requires .values(...)');
    const { names, cols, rows } = insertValues(t, this._values);
    let text = `INSERT INTO ${q(t.name)} (${names.map(q).join(', ')}) VALUES `;
    text += rows.map((r) => `(${r.map(() => '?').join(', ')})`).join(', ');
    ctx.params.push(...rows.flat());
    if (this._conflict) {
      const target = this._conflict.target
        ? ` (${(Array.isArray(this._conflict.target) ? this._conflict.target : [this._conflict.target])
            .map((c) => q(c.name))
            .join(', ')})`
        : '';
      if (this._conflict.action === 'nothing') {
        text += ` ON CONFLICT${target} DO NOTHING`;
      } else {
        const setParts = Object.entries(this._conflict.set).map(([key, val]) => {
          const col = t.cols[key];
          if (!col) throw new Error(`mock-sdk/db: onConflictDoUpdate set has unknown column ${key}`);
          if (val && (val.kind === 'sql' || val.kind === 'sql-raw')) {
            const e = compileSqlNode(val, ctx);
            return `${q(col.name)} = ${e.text}`;
          }
          ctx.params.push(toWire(col, val));
          return `${q(col.name)} = ?`;
        });
        text += ` ON CONFLICT${target} DO UPDATE SET ${setParts.join(', ')}`;
      }
    }
    if (this._returning !== undefined) text += ` RETURNING ${returningCols(t, this._returning)}`;
    return text;
  }
  async run() {
    const ctx = { params: [], mode: 'param' };
    const text = this._sql(ctx);
    if (this._returning !== undefined) {
      const rows = stmt(text).all(...ctx.params);
      return mapRows(this._t, rows, this._returning);
    }
    const r = stmt(text).run(...ctx.params);
    return { rowsAffected: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid), rows: [] };
  }
  then(onF, onR) {
    return this.run().then(onF, onR);
  }
}

class UpdateBuilder {
  constructor(t) {
    this._t = t;
    this._set = null;
    this._wheres = [];
    this._returning = undefined;
  }
  set(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('mock-sdk/db: update.set requires an object');
    this._set = obj;
    return this;
  }
  where(...conds) {
    this._wheres.push(...conds);
    return this;
  }
  returning(projection = null) {
    this._returning = projection;
    return this;
  }
  _sql(ctx) {
    const t = this._t;
    if (!this._set) throw new Error('mock-sdk/db: update requires .set(...) — no-op updates are refused');
    const setParts = Object.entries(this._set)
      .filter(([, v]) => v !== undefined)
      .map(([key, val]) => {
        const col = t.cols[key];
        if (!col) throw new Error(`mock-sdk/db: update of ${t.name} has unknown column ${key}`);
        if (col.o.deprecated) throw new Error(`mock-sdk/db: cannot update deprecated column ${key}`);
        if (val && (val.kind === 'sql' || val.kind === 'sql-raw')) {
          const e = compileSqlNode(val, ctx);
          return `${q(col.name)} = ${e.text}`;
        }
        ctx.params.push(toWire(col, val));
        return `${q(col.name)} = ?`;
      });
    let text = `UPDATE ${q(t.name)} SET ${setParts.join(', ')}`;
    const where = and(...this._wheres);
    if (where) text += ` WHERE ${compileCond(where, ctx).text}`;
    if (this._returning !== undefined) text += ` RETURNING ${returningCols(t, this._returning)}`;
    return text;
  }
  async run() {
    const ctx = { params: [], mode: 'param' };
    const text = this._sql(ctx);
    if (this._returning !== undefined) {
      const rows = stmt(text).all(...ctx.params);
      return mapRows(this._t, rows, this._returning);
    }
    const r = stmt(text).run(...ctx.params);
    return { rowsAffected: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid), rows: [] };
  }
  then(onF, onR) {
    return this.run().then(onF, onR);
  }
}

class DeleteBuilder {
  constructor(t) {
    this._t = t;
    this._wheres = [];
    this._returning = undefined;
  }
  where(...conds) {
    this._wheres.push(...conds);
    return this;
  }
  returning(projection = null) {
    this._returning = projection;
    return this;
  }
  _sql(ctx) {
    let text = `DELETE FROM ${q(this._t.name)}`;
    const where = and(...this._wheres);
    if (where) text += ` WHERE ${compileCond(where, ctx).text}`;
    if (this._returning !== undefined) text += ` RETURNING ${returningCols(this._t, this._returning)}`;
    return text;
  }
  async run() {
    const ctx = { params: [], mode: 'param' };
    const text = this._sql(ctx);
    if (this._returning !== undefined) {
      const rows = stmt(text).all(...ctx.params);
      return mapRows(this._t, rows, this._returning);
    }
    const r = stmt(text).run(...ctx.params);
    return { rowsAffected: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid), rows: [] };
  }
  then(onF, onR) {
    return this.run().then(onF, onR);
  }
}

class SelectBuilder {
  constructor(projection) {
    this._projection = projection ?? null; // null = SELECT *
    this._from = null;
    this._wheres = [];
    this._orders = [];
    this._limit = null;
    this._offset = null;
    this._groups = [];
    this._having = null;
    this._distinct = false;
  }
  from(t) {
    if (!(t instanceof Table)) throw new Error('mock-sdk/db: .from() expects a table descriptor');
    this._from = t;
    return this;
  }
  where(...conds) {
    this._wheres.push(...conds);
    return this;
  }
  orderBy(...items) {
    this._orders.push(...items);
    return this;
  }
  limit(n) {
    this._limit = n;
    return this;
  }
  offset(n) {
    this._offset = n;
    return this;
  }
  groupBy(...cols) {
    this._groups.push(...cols);
    return this;
  }
  having(cond) {
    this._having = cond;
    return this;
  }
  distinct() {
    this._distinct = true;
    return this;
  }
  _sql(ctx) {
    if (!this._from) throw new Error('mock-sdk/db: select requires .from(table)');
    const t = this._from;
    let projSql;
    if (this._projection == null) {
      projSql = '*';
    } else {
      projSql = Object.entries(this._projection)
        .map(([alias, expr]) => {
          const e = compileExpr(expr, ctx);
          // Only a column ref selected under its own SQL name needs no AS;
          // expressions always need the alias to be addressable.
          return isColumnRef(expr) && alias === expr.name ? e.text : `${e.text} AS ${q(alias)}`;
        })
        .join(', ');
    }
    let text = `SELECT ${this._distinct ? 'DISTINCT ' : ''}${projSql} FROM ${q(t.name)}`;
    const where = and(...this._wheres);
    if (where) text += ` WHERE ${compileCond(where, ctx).text}`;
    if (this._groups.length) {
      text += ` GROUP BY ${this._groups.map((g) => compileExpr(g, ctx).text).join(', ')}`;
    }
    if (this._having) text += ` HAVING ${compileCond(this._having, ctx).text}`;
    if (this._orders.length) {
      text += ` ORDER BY ${this._orders
        .map((o) => {
          if (o && o.kind === 'order') return `${compileExpr(o.expr, ctx).text} ${o.dir}`;
          if (typeof o === 'string') return o; // raw order text (documented escape hatch)
          return compileExpr(o, ctx).text;
        })
        .join(', ')}`;
    }
    if (this._limit != null) {
      ctx.params.push(this._limit);
      text += ` LIMIT ?`;
      if (this._offset != null) {
        ctx.params.push(this._offset);
        text += ` OFFSET ?`;
      }
    } else if (this._offset != null) {
      // SQLite allows OFFSET only with LIMIT; emulate with a huge LIMIT.
      ctx.params.push(-1, this._offset);
      text += ` LIMIT ? OFFSET ?`;
    }
    return text;
  }
  /** Terminal: rows as objects (mode-converted, since bound to the table). */
  async all() {
    const ctx = { params: [], mode: 'param' };
    const rows = stmt(this._sql(ctx)).all(...ctx.params);
    return mapRows(this._from, rows, this._projection);
  }
  /** Terminal: first row or null. */
  async get() {
    const rows = await this.limit(1).all();
    return rows.length ? rows[0] : null;
  }
  /** Terminal: rows as positional arrays. */
  async values() {
    const ctx = { params: [], mode: 'param' };
    const rows = stmt(this._sql(ctx)).all(...ctx.params);
    if (this._projection == null) {
      const cols = Object.values(this._from.cols).filter((c) => !c.o.deprecated);
      return rows.map((r) => cols.map((c) => fromWire(c, r[c.name])));
    }
    // Projection: positional values in projection order, mode-converted for
    // column refs, raw for sql expressions.
    const entries = Object.entries(this._projection);
    return rows.map((r) =>
      entries.map(([alias, expr]) => (isColumnRef(expr) ? fromWire(expr, r[alias]) : r[alias]))
    );
  }
  then(onF, onR) {
    // Awaitable: default terminal is .all() (documented behaviour).
    return this.all().then(onF, onR);
  }
}

// ---------------------------------------------------------------------------
// db facade
// ---------------------------------------------------------------------------

const db = {
  select(projection) {
    return new SelectBuilder(projection);
  },
  insert(t) {
    if (!(t instanceof Table)) throw new Error('mock-sdk/db: insert expects a table descriptor');
    return new InsertBuilder(t);
  },
  update(t) {
    if (!(t instanceof Table)) throw new Error('mock-sdk/db: update expects a table descriptor');
    return new UpdateBuilder(t);
  },
  delete(t) {
    if (!(t instanceof Table)) throw new Error('mock-sdk/db: delete expects a table descriptor');
    return new DeleteBuilder(t);
  },
  /** COUNT(*) with an optional where condition → number. */
  async $count(t, where) {
    if (!(t instanceof Table)) throw new Error('mock-sdk/db: $count expects a table descriptor');
    const ctx = { params: [], mode: 'param' };
    let text = `SELECT count(*) AS n FROM ${q(t.name)}`;
    const cond = where ? and(where) : null;
    if (cond) text += ` WHERE ${compileCond(cond, ctx).text}`;
    const row = stmt(text).get(...ctx.params);
    return Number(row.n);
  },
  /** Raw write/exec. Accepts sql`…` or (queryString, params). No mode conversion. */
  run(q1, q2) {
    return rawExec('run', q1, q2);
  },
  /** Raw SELECT all rows — raw wire values (no mode conversion). */
  all(q1, q2) {
    return rawExec('all', q1, q2);
  },
  /** Raw first row or null — raw wire values. */
  get(q1, q2) {
    return rawExec('get', q1, q2);
  },
  /** Raw rows as positional arrays — useful when column names collide in joins. */
  values(q1, q2) {
    return rawExec('values', q1, q2);
  },
};

export default db;
export { db };
