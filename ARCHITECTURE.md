# Architecture

```
+-------------------+          +------------------+          +-----------------+
|  User Browser     | -------> | Cloudflare Edge  | <--------| EC2 t2.micro    |
| (public shortlink)|   HTTPS  | (TLS, WAF, Access)| outbound| (Ubuntu 22.04)  |
+-------------------+          +------------------+  only   +-----------------+
                                      |                    | Docker Compose |
                                      |                    |  + App (Node)  |
                                      |                    |  + Caddy (:80) |
                                      |                    |  + cloudflared |
                                      |                    +-----------------+
```

## Flow

1. End users hit `https://<public-domain>`.
2. Cloudflare terminates TLS, applies WAF rules, and enforces Access on `/`.
3. Traffic is forwarded through the named Cloudflare Tunnel to the EC2 host.
4. `cloudflared` forwards requests to `http://localhost:80`.
5. Caddy reverse-proxies to the Node.js app container on port `3000`.
6. Node persists links and click counters in SQLite on a mounted Docker volume (`/data`).

## Security posture

- EC2 inbound is SSH-only from your IP.
- Ports `80/443` remain closed on EC2 public IP.
- Tunnel is outbound-only, so no public listener is required on the host.
