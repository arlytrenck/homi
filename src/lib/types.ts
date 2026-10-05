export type Status = "up" | "down" | "degraded" | "unknown";
export interface CheckInfo {
  id: string; status: Status; latencyMs: number | null; checkedAt: number | null; changedAt: number | null; enabled: boolean;
  type?: "http" | "tcp" | "ping"; target?: string; intervalS?: number; timeoutMs?: number; expectedStatus?: string; keyword?: string | null; ignoreTls?: boolean;
}
export interface ServiceDTO {
  id: string; groupId: string | null; name: string; description: string | null; url: string; icon: string | null;
  targetBlank: boolean; tags: string[]; hiddenPublic: boolean; status: CheckInfo | null;
}
export interface GroupDTO { id: string; name: string; icon: string | null; collapsed: boolean }
export interface DashboardDTO { groups: GroupDTO[]; services: ServiceDTO[]; settings: { title: string; theme: string }; viewer: "admin" | "public" }
