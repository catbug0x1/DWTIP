#!/bin/bash
set -e

echo "========================================="
echo "  DWTIP - Dark Web Threat Intelligence"
echo "           Platform Installer"
echo "========================================="

check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "Installing $1..."
        return 1
    fi
    return 0
}

install_deps_arch() {
    echo "[*] Installing system dependencies (Arch Linux)..."
    sudo pacman -Sy --noconfirm \
        python python-pip python-venv git curl wget \
        tor geoip2 libgeoip \
        chromium firefox postgresql redis \
        nodejs npm mongodb-bin
    
    echo "[*] Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r dwtip/backend/requirements.txt
    
    echo "[*] Installing Node.js dependencies..."
    cd dwtip/frontend && npm install && cd ../..
}

install_deps_ubuntu() {
    echo "[*] Installing system dependencies (Ubuntu/Debian)..."
    sudo apt-get update
    sudo apt-get install -y \
        python3 python3-pip python3-venv git curl wget \
        tor geoipupdate libgeoip-dev \
        chromium-browser firefox postgresql postgresql-contrib redis-server \
        nodejs npm mongodb
    
    echo "[*] Installing Python dependencies..."
    pip3 install --upgrade pip
    pip3 install -r dwtip/backend/requirements.txt
    
    echo "[*] Installing Node.js dependencies..."
    cd dwtip/frontend && npm install && cd ../..
}

install_docker() {
    if ! command -v docker &> /dev/null; then
        echo "[*] Installing Docker..."
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
        sudo sh /tmp/get-docker.sh
        sudo usermod -aG docker $USER
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "[*] Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi
}

setup_tor() {
    echo "[*] Configuring Tor..."
    sudo systemctl enable tor
    sudo systemctl start tor
    
    if [ ! -f /etc/tor/torrc.backup ]; then
        sudo cp /etc/tor/torrc /etc/tor/torrc.backup
    fi
    
    sudo tee /etc/tor/torrc > /dev/null <<EOF
SOCKSPort 9050
ControlPort 9051
CookieAuthentication 1
DataDirectory /var/lib/tor
ExitPolicy reject *:*
MaxCircuitDirtiness 10 minutes
NewCircuitPeriod 15 seconds
NumEntryGuards 8
StrictNodes 1
EOF
    
    sudo systemctl restart tor
}

setup_databases() {
    echo "[*] Setting up databases..."
    
    echo "[*] Starting PostgreSQL..."
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
    
    echo "[*] Creating PostgreSQL database..."
    sudo -u postgres psql -c "CREATE USER dwtip WITH PASSWORD 'dwtip_secure_password';" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE DATABASE dwtip OWNER dwtip;" 2>/dev/null || true
    sudo -u postgres psql -d dwtip -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" 2>/dev/null || true
    
    echo "[*] Starting Redis..."
    sudo systemctl enable redis
    sudo systemctl start redis
    
    echo "[*] Starting MongoDB..."
    sudo systemctl enable mongodb
    sudo systemctl start mongodb
}

setup_env() {
    echo "[*] Setting up environment variables..."
    
    if [ ! -f .env ]; then
        cp config/.env.example .env
        echo "[!] Please edit dwtip/.env with your configuration"
    fi
}

init_database_schemas() {
    echo "[*] Initializing database schemas..."
    cd dwtip
    python3 -c "
from backend.core.database import init_postgresql, init_mongodb
import asyncio
asyncio.run(init_postgresql())
asyncio.run(init_mongodb())
print('[+] Database schemas initialized')
"
    cd ..
}

build_frontend() {
    echo "[*] Building frontend..."
    cd dwtip/frontend
    npm run build
    cd ..
}

print_success() {
    echo ""
    echo "========================================="
    echo "  Installation Complete!"
    echo "========================================="
    echo ""
    echo "Next steps:"
    echo "  1. Edit dwtip/.env with your configuration"
    echo "  2. Run: cd dwtip && docker-compose up -d"
    echo "  3. Or run manually:"
    echo "     - cd dwtip/backend && uvicorn api.main:app --reload"
    echo "     - cd dwtip/frontend && npm start"
    echo ""
    echo "Default credentials:"
    echo "  API: http://localhost:8000"
    echo "  Frontend: http://localhost:3000"
    echo "  API Docs: http://localhost:8000/docs"
    echo ""
}

main() {
    if [ "$EUID" -eq 0 ]; then
        echo "[!] Running as root"
    fi
    
    if check_command docker; then
        install_docker
        echo "[*] Using Docker deployment..."
        setup_env
        print_success
        exit 0
    fi
    
    if check_command pacman &> /dev/null; then
        install_deps_arch || true
    elif check_command apt-get &> /dev/null; then
        install_deps_ubuntu || true
    fi
    
    setup_tor
    setup_databases
    setup_env
    init_database_schemas
    
    print_success
}

main "$@"
