import { z } from "zod";

export const CheckInput = z.object({
  type: z.enum(["http", "tcp", "ping"]),
  target: z.string().trim().min(1).max(500),
  intervalS: z.number().int().min(10).max(86400).default(60),
  timeoutMs: z.number().int().min(500).max(30000).default(5000),
  expectedStatus: z.string().regex(/^\d{3}(-\d{3})?$/).default("200-399"),
  keyword: z.string().max(200).nullish(),
  ignoreTls: z.boolean().default(false),
  enabled: z.boolean().default(true),
});
export type CheckInput = z.infer<typeof CheckInput>;

const httpUrl = z.string().trim().max(2000).refine((u) => { try { return ["http:", "https:"].includes(new URL(u).protocol); } catch { return false; } }, "Must be an http(s) URL");

export const ServiceInput = z.object({
  groupId: z.string().nullish(),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(300).nullish(),
  url: httpUrl,
  icon: z.string().max(300).nullish(),
  targetBlank: z.boolean().default(true),
  tags: z.array(z.string().max(32)).max(16).default([]),
  hiddenPublic: z.boolean().default(false),
  check: CheckInput.nullish(),
});
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

const baseUrl = z.string().trim().max(500).refine((u) => /^https?:\/\/[^\s/]+/i.test(u) || /^unix:\/\/\/\S+$/.test(u), "Must be an http(s) URL (or unix:///path for Docker)");

export const IntegrationInput = z.object({
  type: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(100),
  baseUrl,
  config: z.record(z.string(), z.any()).default({}),
  /** undefined/omitted = keep, null = clear, string = set */
  secrets: z.record(z.string(), z.string().nullable()).default({}),
  ignoreTls: z.boolean().default(false),
  enabled: z.boolean().default(true),
});
export type IntegrationInput = z.infer<typeof IntegrationInput>;

export const IntegrationTestInput = z.object({
  integrationId: z.string().optional(),
  type: z.string().min(1).max(40),
  baseUrl,
  config: z.record(z.string(), z.any()).default({}),
  secrets: z.record(z.string(), z.string().nullable()).default({}),
  ignoreTls: z.boolean().default(false),
});

export const WidgetInput = z.object({
  kind: z.string().min(1).max(80),
  integrationId: z.string().nullish(),
  title: z.string().max(100).nullish(),
  options: z.record(z.string(), z.any()).default({}),
  area: z.enum(["header", "main", "sidebar"]).default("main"),
  size: z.enum(["sm", "md", "lg"]).default("md"),
  hiddenPublic: z.boolean().default(true),
});
export type WidgetInput = z.infer<typeof WidgetInput>;
