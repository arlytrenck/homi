import { sqliteTable, text, integer, real, index, primaryKey } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const ts = (n: string) => integer(n).notNull();

export const users = sqliteTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

export const sessions = sqliteTable("sessions", {
  id: id(), // sha256(token) hex
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: ts("created_at"),
  lastSeenAt: ts("last_seen_at"),
  expiresAt: ts("expires_at"),
  userAgent: text("user_agent"),
  ip: text("ip"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
});

export const groups = sqliteTable("groups", {
  id: id(),
  name: text("name").notNull(),
  icon: text("icon"),
  sort: integer("sort").notNull().default(0),
  collapsed: integer("collapsed", { mode: "boolean" }).notNull().default(false),
  createdAt: ts("created_at"),
});

export const services = sqliteTable("services", {
  id: id(),
  groupId: text("group_id").references(() => groups.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  icon: text("icon"),
  sort: integer("sort").notNull().default(0),
  targetBlank: integer("target_blank", { mode: "boolean" }).notNull().default(true),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  source: text("source", { enum: ["manual", "docker"] }).notNull().default("manual"),
  sourceRef: text("source_ref"),
  missingSince: integer("missing_since"),
  hiddenPublic: integer("hidden_public", { mode: "boolean" }).notNull().default(false),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

export const checks = sqliteTable("checks", {
  id: id(),
  serviceId: text("service_id").unique().references(() => services.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", { enum: ["http", "tcp", "ping"] }).notNull(),
  target: text("target").notNull(),
  intervalS: integer("interval_s").notNull().default(60),
  timeoutMs: integer("timeout_ms").notNull().default(5000),
  httpMethod: text("http_method").notNull().default("GET"),
  expectedStatus: text("expected_status").notNull().default("200-399"),
  keyword: text("keyword"),
  ignoreTls: integer("ignore_tls", { mode: "boolean" }).notNull().default(false),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastStatus: text("last_status", { enum: ["up", "down", "degraded", "unknown"] }).notNull().default("unknown"),
  lastLatencyMs: integer("last_latency_ms"),
  lastCheckedAt: integer("last_checked_at"),
  lastChangeAt: integer("last_change_at"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
});

export const checkResults = sqliteTable(
  "check_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    checkId: text("check_id").notNull().references(() => checks.id, { onDelete: "cascade" }),
    ts: ts("ts"),
    ok: integer("ok", { mode: "boolean" }).notNull(),
    latencyMs: integer("latency_ms"),
    code: integer("code"),
    error: text("error"),
  },
  (t) => [index("check_results_check_ts").on(t.checkId, t.ts)],
);

export const checkRollups = sqliteTable(
  "check_rollups",
  {
    checkId: text("check_id").notNull().references(() => checks.id, { onDelete: "cascade" }),
    bucketTs: integer("bucket_ts").notNull(),
    samples: integer("samples").notNull(),
    ups: integer("ups").notNull(),
    avgLatency: real("avg_latency"),
  },
  (t) => [primaryKey({ columns: [t.checkId, t.bucketTs] })],
);

export const integrations = sqliteTable("integrations", {
  id: id(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  config: text("config", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  secrets: text("secrets"), // encrypted envelope JSON
  ignoreTls: integer("ignore_tls", { mode: "boolean" }).notNull().default(false),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  pollIntervalS: integer("poll_interval_s").notNull().default(60),
  lastOkAt: integer("last_ok_at"),
  lastError: text("last_error"),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

export const widgets = sqliteTable("widgets", {
  id: id(),
  kind: text("kind").notNull(),
  integrationId: text("integration_id").references(() => integrations.id, { onDelete: "cascade" }),
  title: text("title"),
  options: text("options", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  area: text("area", { enum: ["header", "main", "sidebar"] }).notNull().default("main"),
  sort: integer("sort").notNull().default(0),
  size: text("size", { enum: ["sm", "md", "lg"] }).notNull().default("md"),
  hiddenPublic: integer("hidden_public", { mode: "boolean" }).notNull().default(true),
});

export const notes = sqliteTable("notes", {
  id: id(),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull().default(""),
  sort: integer("sort").notNull().default(0),
  updatedAt: ts("updated_at"),
});

export const bookmarks = sqliteTable("bookmarks", {
  id: id(),
  groupLabel: text("group_label").notNull().default("Bookmarks"),
  name: text("name").notNull(),
  url: text("url").notNull(),
  icon: text("icon"),
  sort: integer("sort").notNull().default(0),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ts: ts("ts"),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: text("detail", { mode: "json" }),
});
