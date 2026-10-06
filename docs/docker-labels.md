# Docker auto-discovery

Homi can create services from running containers. Add labels to a container and it appears on the dashboard within about 30 seconds; remove the container and the tile follows.

## Enable

Mount the Docker socket into Homi (read-only, see the security note below), or point `HOMI_DOCKER_HOST` at a [docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy):

```yaml
services:
  homi:
    image: ghcr.io/arlytrenck/homi:latest
    environment:
      HOMI_DISCOVERY_HOST: nas.lan          # host used to build URLs from published ports (optional)
      # HOMI_DOCKER_HOST: http://socket-proxy:2375   # instead of the socket mount
    volumes:
      - ./data:/data
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

Then label a container:

```yaml
services:
  plex:
    image: plexinc/pms-docker
    labels:
      homi.enable: "true"
      homi.name: Plex
      homi.group: Media
      homi.url: https://plex.example.com
      homi.icon: https://example.com/plex.png
      homi.description: Media server
```

## Labels

| Label | Meaning |
|---|---|
| `homi.enable` | `true` to opt in. Containers without it are ignored. |
| `homi.name` | Display name. Defaults to the container name. |
| `homi.group` | Group name; created if it does not exist. |
| `homi.url` | Link target (http/https). If omitted, built from the first published TCP port and `HOMI_DISCOVERY_HOST`. |
| `homi.icon` | Image URL or a single emoji. |
| `homi.description` | Short text under the name. |
| `homi.check` | `http` (default), `tcp`, `ping` or `none`. |
| `homi.check.target` | Check target. `http`: URL (defaults to `homi.url`). `tcp`: `host:port` (required). `ping`: host (defaults to the URL's host). |
| `homi.public` | `false` hides the service from the public view. |

A container with invalid labels is skipped and the reason is shown in **Settings → Docker discovery**. If a previously valid container gets a bad label, its existing tile is kept rather than removed.

## Behaviour

- **Label-owned fields** (name, URL, icon, description, public flag, check) are rewritten on every sync. They are read-only in the UI; edit the labels instead.
- **Group and order** are set when the service is first created. After that you can move it to another group or reorder it in the UI and Homi will keep your arrangement.
- Services are tracked by **container name**, so recreating a container (new ID, same name) keeps its tile, history and position.
- When a container stops or disappears, its tile stays for **24 hours** marked "Container not running" with its check paused, then it is removed. If the container returns, it resumes where it left off.
- Docker-managed services are not included in YAML backups; your labels are the source of truth. They cannot be deleted from the UI; remove the `homi.enable` label or the container.
- Environment: `HOMI_DOCKER_HOST` (`unix:///path.sock` or an `http(s)://` URL), `HOMI_DISCOVERY_HOST`, `HOMI_DISCOVERY=off` to disable.

## Security note

A mounted Docker socket gives whatever can reach it control over the host, and `:ro` does not restrict the API. Homi only ever issues a single read-only `GET /containers/json`, but a compromise of Homi would still expose the socket. The safer setup is a socket proxy exposing only `CONTAINERS=1`:

```yaml
  socket-proxy:
    image: tecnativa/docker-socket-proxy
    environment: { CONTAINERS: 1 }
    volumes: ["/var/run/docker.sock:/var/run/docker.sock:ro"]
```

and `HOMI_DOCKER_HOST=http://socket-proxy:2375` on Homi. Discovery is off unless a socket is mounted or `HOMI_DOCKER_HOST` is set.
