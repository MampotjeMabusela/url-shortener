# URL Shortener (WriteNow Assessment)

Production-ready URL shortener with:

- `POST /api/shorten` (Basic Auth + rate limit)
- `GET /:slug` redirect + click tracking
- `GET /api/stats/:slug` link analytics
- `GET /` admin dashboard (Basic Auth, plus Cloudflare Access in production)
- `GET /healthz` for uptime checks

## 1) Local quickstart

```bash
cp .env.example .env
```

Set values in `.env`:

```env
ADMIN_USER=admin
ADMIN_PASS=test123
PUBLIC_DOMAIN=localhost
PORT=3000
DB_PATH=/data/shortener.db
```

Run with Docker:

```bash
docker compose up --build
```

Open `http://localhost`, authenticate, shorten a URL, and verify redirects/stats.

## 2) EC2 provisioning (Ubuntu 22.04, free tier)

### Launch instance

- EC2 type: `t2.micro` or `t3.micro`
- Root disk: `gp3`, `<=30GB`
- Security group inbound: only `22/tcp` from your IP
- No inbound `80/443`

### SSH and install Docker

```bash
ssh -i ~/.ssh/shortener-key.pem ubuntu@<EC2_PUBLIC_IP>
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

### Configure swap (1GB)

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### Deploy app

```bash
git clone https://github.com/<you>/url-shortener.git
cd url-shortener
cp .env.example .env
nano .env
docker compose up -d --build
```

## 3) Systemd startup for compose

```bash
sudo tee /etc/systemd/system/shortener.service > /dev/null <<'EOF'
[Unit]
Description=URL Shortener Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/url-shortener
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable shortener.service
sudo systemctl start shortener.service
sudo systemctl status shortener.service
```

## 4) Cloudflare Tunnel

Install and authenticate:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
cloudflared tunnel login
cloudflared tunnel create shortener-tunnel
```

Create config at `~/.cloudflared/config.yml`:

```yml
tunnel: <TUNNEL_ID>
credentials-file: /home/ubuntu/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: shortener.example.com
    service: http://localhost:80
  - service: http_status:404
```

Install as service and run:

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

In Cloudflare DNS, point your hostname CNAME to `<TUNNEL_ID>.cfargotunnel.com` (proxied).

## 5) Production hardening checklist

- SSL/TLS mode: **Full (strict)**
- **Always Use HTTPS**: enabled
- WAF rate limit on `/api/shorten`: `10 req / 1 min / IP`
- Cloudflare Access on `/` with OTP email
- Cache rules:
  - bypass `/api/*`
  - bypass slug routes
  - allow `.css` static caching

## 6) Update deployment

```bash
chmod +x deploy.sh
./deploy.sh
```

## 7) Verification commands

```bash
curl https://<domain>/healthz
curl -u admin:<password> -X POST https://<domain>/api/shorten -H "Content-Type: application/json" -d '{"long_url":"https://example.com"}'
curl https://<domain>/api/stats/<slug>
nmap -Pn -p 80,443 <EC2_PUBLIC_IP>
```
