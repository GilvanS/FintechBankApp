#!/usr/bin/env bash
# Instala o Docker Engine (sem Docker Desktop) dentro da distro WSL2 "Ubuntu"
# e configura o systemd para subir o dockerd sozinho a cada boot do WSL.
#
# Uso: rodar UMA VEZ dentro do WSL (Ubuntu):
#   wsl -d Ubuntu
#   bash /mnt/f/GITHUB/FintechBankApp/scripts/setup-docker-wsl.sh
set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  echo "Nao rode como root direto; rode como seu usuario normal (o script usa sudo quando precisa)." >&2
  exit 1
fi

echo "==> 1/5 Habilitando systemd no WSL2"
if ! grep -q "^systemd=true" /etc/wsl.conf 2>/dev/null; then
  sudo tee -a /etc/wsl.conf >/dev/null <<'EOF'

[boot]
systemd=true
EOF
  echo
  echo "!! systemd foi habilitado agora. Precisa reiniciar o WSL para aplicar."
  echo "!! Rode no PowerShell:  wsl --shutdown"
  echo "!! Depois abra o Ubuntu de novo e rode este script mais uma vez para continuar."
  exit 0
fi
echo "    systemd ja habilitado."

echo "==> 2/5 Instalando dependencias"
sudo apt-get update -qq
sudo apt-get install -y -qq ca-certificates curl gnupg >/dev/null

echo "==> 3/5 Adicionando repositorio oficial do Docker"
sudo install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
fi
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

echo "==> 4/5 Instalando Docker Engine + Compose plugin"
sudo apt-get update -qq
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> 5/5 Habilitando autostart via systemd e liberando uso sem sudo"
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker "$USER"

echo
echo "Pronto. Feche este terminal e abra outro (ou rode 'newgrp docker') para o grupo docker valer."
echo "Teste com: docker --version && docker compose version"
