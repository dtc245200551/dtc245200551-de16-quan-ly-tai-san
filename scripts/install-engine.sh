#!/bin/sh
# Run as root inside a dedicated Ubuntu 24.04 WSL2 distribution.
set -eu
[ "$(id -u)" = 0 ] || { echo 'Run this script as root in Ubuntu.'; exit 1; }
. /etc/os-release
[ "$ID" = ubuntu ] && [ "$VERSION_ID" = 24.04 ] || { echo 'Ubuntu 24.04 required.'; exit 1; }
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git openssl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
if ! id hai >/dev/null 2>&1; then useradd --create-home --shell /bin/bash hai; fi
usermod -aG docker hai
mkdir -p /home/hai/projects
chown hai:hai /home/hai/projects
docker version
docker compose version
