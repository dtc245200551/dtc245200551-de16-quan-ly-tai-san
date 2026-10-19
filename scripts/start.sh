#!/bin/sh
set -eu
. "$(dirname -- "$0")/common.sh"
sh scripts/prepare.sh
docker info --format '{{.OperatingSystem}} | {{.ServerVersion}} | {{.CgroupVersion}}'
dc config --quiet
dc build app
dc up -d --wait --wait-timeout 300
printf '%s\n' 'Website http://localhost:8086 | pgAdmin http://localhost:8087' 'Website user: admin. Password file: .local/secrets/admin_password'
