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
