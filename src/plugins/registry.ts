import type { CoreWidgetDef, IntegrationPlugin, WidgetDef } from "./sdk";
import { coreWidgets } from "./core";
import pihole from "./pihole";
import adguard from "./adguard";
import uptimekuma from "./uptimekuma";
import { sonarr, radarr, lidarr, prowlarr } from "./arr";
import proxmox from "./proxmox";
import truenas from "./truenas";
import docker from "./docker";
import grafana from "./grafana";
import authentik from "./authentik";
import unifi from "./unifi";
import synology from "./synology";

export const plugins: IntegrationPlugin[] = [proxmox, docker, pihole, adguard, unifi, synology, truenas, sonarr, radarr, lidarr, prowlarr, authentik, uptimekuma, grafana];

export const getPlugin = (id: string) => plugins.find((p) => p.id === id);

export type AnyWidget = (WidgetDef | CoreWidgetDef) & { pluginId: string | null };
export const widgetRegistry: Record<string, AnyWidget> = {};
for (const w of coreWidgets) widgetRegistry[w.id] = { ...w, pluginId: null };
for (const p of plugins) for (const w of p.widgets) widgetRegistry[w.id] = { ...w, pluginId: p.id };
