import { z } from "zod";
import { validTimeZone } from "@/server/notify/quiet";

export const CheckInput = z.object({
  type: z.enum(["http", "tcp", "ping", "tls", "heartbeat"]),
  target: z.string().trim().min(1).max(500),
  intervalS: z.number().int().min(10).max(86400).default(60),
  timeoutMs: z.number().int().min(500).max(30000).default(5000),
  httpMethod: z.enum(["GET", "HEAD"]).default("GET"),
  expectedStatus: z.string().regex(/^\d{3}(-\d{3})?$/).default("200-399"),
  keyword: z.string().max(200).nullish(),
  ignoreTls: z.boolean().default(false),
  enabled: z.boolean().default(true),
});
export type CheckInput = z.infer<typeof CheckInput>;

const httpUrl = z.string().trim().max(2000).refine((u) => { try { return ["http:", "https:"].includes(new URL(u).protocol); } catch { return false; } }, "Must be an http(s) URL");

const serviceShape = {
  groupId: z.string().nullish(),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(300).nullish(),
  url: httpUrl,
  icon: z.string().max(300).nullish(),
  targetBlank: z.boolean(),
  tags: z.array(z.string().max(32)).max(16),
  hiddenPublic: z.boolean(),
  alertsMuted: z.boolean(),
  check: CheckInput.nullish(),
};
// Defaults live only on the create schema; patch schemas must not inject them.
export const ServiceInput = z.object({ ...serviceShape, targetBlank: serviceShape.targetBlank.default(true), tags: serviceShape.tags.default([]), hiddenPublic: serviceShape.hiddenPublic.default(false), alertsMuted: serviceShape.alertsMuted.default(false) });
export const ServicePatch = z.object(serviceShape).partial();
export type ServiceInput = z.infer<typeof ServiceInput>;

export const GroupInput = z.object({ name: z.string().trim().min(1).max(100), icon: z.string().max(300).nullish(), collapsed: z.boolean().optional() });

export const LayoutInput = z.object({
  groups: z.array(z.object({ id: z.string().nullable(), serviceIds: z.array(z.string()) })).max(500),
  groupOrder: z.array(z.string()).max(500).optional(),
});

export const SettingsInput = z.object({
  title: z.string().max(60).optional(),
  theme: z.enum(["system", "light", "dark"]).optional(),
  publicView: z.boolean().optional(),
  allowLoopback: z.boolean().optional(),
  retentionHours: z.number().int().min(1).max(24 * 30).optional(),
  weather: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), units: z.enum(["metric", "imperial"]) }).nullish(),
});

const destUrl = z.string().trim().max(1000).refine((u) => /^https?:\/\/[^\s/]+/i.test(u), "Must be an http(s) URL");
export const NotificationsInput = z.object({
  destinations: z.array(z.object({
    /** present = an existing destination (its URL is kept when `url` is omitted) */
    id: z.string().max(40).optional(),
    kind: z.enum(["webhook", "ntfy"]),
    url: destUrl.optional(),
    enabled: z.boolean(),
    onRecovery: z.boolean(),
    groupIds: z.array(z.string().max(40)).max(200).default([]),
    tags: z.array(z.string().trim().min(1).max(32)).max(20).default([]),
    quiet: z.object({
      enabled: z.boolean(),
      start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      tz: z.string().max(64).refine(validTimeZone, "Unknown time zone"),
      digest: z.boolean(),
      overrideTags: z.array(z.string().trim().min(1).max(32)).max(20).default([]),
    }).optional(),
  })).max(5),
});
export const NotificationsTest = z.object({ id: z.string().max(40).optional(), kind: z.enum(["webhook", "ntfy"]).optional(), url: destUrl.optional() });

const baseUrl = z.string().trim().max(500).refine((u) => /^https?:\/\/[^\s/]+/i.test(u) || /^unix:\/\/\/\S+$/.test(u), "Must be an http(s) URL (or unix:///path for Docker)");

const integrationShape = {
  type: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(100),
  baseUrl,
  config: z.record(z.string(), z.any()),
  /** undefined/omitted = keep, null = clear, string = set */
  secrets: z.record(z.string(), z.string().nullable()),
  ignoreTls: z.boolean(),
  enabled: z.boolean(),
};
export const IntegrationInput = z.object({ ...integrationShape, config: integrationShape.config.default({}), secrets: integrationShape.secrets.default({}), ignoreTls: integrationShape.ignoreTls.default(false), enabled: integrationShape.enabled.default(true) });
export const IntegrationPatch = z.object(integrationShape).omit({ type: true }).partial();
export type IntegrationInput = z.infer<typeof IntegrationInput>;

export const IntegrationTestInput = z.object({
  integrationId: z.string().optional(),
  type: z.string().min(1).max(40),
  baseUrl,
  config: z.record(z.string(), z.any()).default({}),
  secrets: z.record(z.string(), z.string().nullable()).default({}),
  ignoreTls: z.boolean().default(false),
});

const widgetShape = {
  kind: z.string().min(1).max(80),
  integrationId: z.string().nullish(),
  title: z.string().max(100).nullish(),
  options: z.record(z.string(), z.any()),
  area: z.enum(["header", "main", "sidebar"]),
  size: z.enum(["sm", "md", "lg"]),
  hiddenPublic: z.boolean(),
};
export const WidgetInput = z.object({ ...widgetShape, options: widgetShape.options.default({}), area: widgetShape.area.default("main"), size: widgetShape.size.default("md"), hiddenPublic: widgetShape.hiddenPublic.default(true) });
export const WidgetPatch = z.object(widgetShape).omit({ kind: true, integrationId: true }).partial();
export type WidgetInput = z.infer<typeof WidgetInput>;

export const MaintenanceInput = z.object({
  name: z.string().trim().max(100).optional(),
  kind: z.enum(["all", "group", "service"]),
  targetId: z.string().max(40).optional(),
  /** epoch ms; omitted = now */
  startsAt: z.number().int().positive().optional(),
  endsAt: z.number().int().positive().optional(),
  /** alternative to endsAt, counted from the start */
  minutes: z.number().int().min(1).max(60 * 24 * 30).optional(),
}).refine((v) => v.kind === "all" || !!v.targetId, { message: "Pick a service or group", path: ["targetId"] })
  .refine((v) => (v.endsAt !== undefined) !== (v.minutes !== undefined), { message: "Give either an end time or a duration", path: ["minutes"] });
