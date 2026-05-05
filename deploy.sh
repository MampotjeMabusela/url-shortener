#!/usr/bin/env bash
set -euo pipefail

cd /home/ubuntu/url-shortener
git pull
docker compose build
docker compose up -d --force-recreate

echo "Deployment complete"
