export type Status = "up" | "down" | "degraded" | "unknown";
export interface CheckInfo {
  id: string; status: Status; latencyMs: number | null; checkedAt: number | null; changedAt: number | null; enabled: boolean;
  type?: "http" | "tcp" | "ping"; target?: string; intervalS?: number; timeoutMs?: number; expectedStatus?: string; keyword?: string | null; ignoreTls?: boolean;
}
export interface ServiceDTO {
  id: string; groupId: string | null; name: string; description: string | null; url: string; icon: string | null;
  targetBlank: boolean; tags: string[]; hiddenPublic: boolean; source: "manual" | "docker"; missing: boolean; status: CheckInfo | null;
}
export interface GroupDTO { id: string; name: string; icon: string | null; collapsed: boolean }
export interface DashboardDTO { groups: GroupDTO[]; services: ServiceDTO[]; widgets: WidgetDTO[]; settings: { title: string; theme: string }; viewer: "admin" | "public" }

export interface WidgetDTO {
  id: string; kind: string; kindTitle: string; title: string | null; size: "sm" | "md" | "lg"; area: "header" | "main" | "sidebar";
  hiddenPublic: boolean; integrationId: string | null; integrationName: string | null; options?: Record<string, any>;
}
export type FieldSpecDTO =
  | { kind: "text" | "textarea" | "url" | "number"; label: string; required?: boolean; placeholder?: string; help?: string }
  | { kind: "secret"; label: string; required?: boolean; help?: string }
  | { kind: "boolean"; label: string; help?: string }
  | { kind: "select"; label: string; options: { value: string; label: string }[]; required?: boolean };
export interface PluginDTO { id: string; name: string; icon: string; description: string; baseUrlPlaceholder: string; config: Record<string, FieldSpecDTO>; secrets: Record<string, FieldSpecDTO>; widgets: { id: string; title: string; options: Record<string, FieldSpecDTO> }[] }
export interface PluginsResponse { core: { id: string; title: string; options: Record<string, FieldSpecDTO> }[]; integrations: PluginDTO[] }
export interface IntegrationDTO { id: string; type: string; name: string; baseUrl: string; config: Record<string, any>; ignoreTls: boolean; enabled: boolean; lastOkAt: number | null; lastError: string | null; secrets: Record<string, { set: true }> }
export interface WidgetData { data?: { stats?: { label: string; value: string; hint?: string; tone?: "ok" | "warn" | "down" | "neutral" }[]; meters?: { label: string; value: number; text?: string }[]; rows?: { primary: string; secondary?: string; tone?: "ok" | "warn" | "down" | "neutral"; href?: string }[]; note?: string }; error?: string; ts: number }
