#!/bin/bash
# One-time EC2 setup for CommuteNG deployment
# Run this as the ubuntu user on the EC2 instance
set -e

DEPLOY_DIR="/home/ubuntu/commute-ng"

echo "=== Setting up CommuteNG deployment ==="

# Install Docker (if not already installed)
if ! command -v docker &> /dev/null; then
    echo "--- Installing Docker ---"
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose-plugin
    sudo usermod -aG docker ubuntu
    echo "Docker installed. You may need to log out and back in for group changes."
fi

# Create deploy directory
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Clone both repos
if [ ! -d "commute-ng-backend" ]; then
    echo "--- Cloning backend ---"
    git clone https://github.com/ch1m3z13/commute-ng-backend.git
fi

if [ ! -d "commute-ng-frontend" ]; then
    echo "--- Cloning frontend ---"
    git clone https://github.com/ch1m3z13/commute-ng-frontend.git
fi

# Copy docker-compose.prod.yml from backend repo
cp commute-ng-backend/docker-compose.prod.yml docker-compose.yml

# Create backend .env file (prompt for values)
if [ ! -f "commute-ng-backend/.env" ]; then
    echo "--- Creating backend .env ---"
    cat > commute-ng-backend/.env <<'ENVEOF'
# Production environment variables
# Fill in the values below

SUPABASE_DATABASE_URL=postgresql://commuteng:CHANGE_ME@postgres:5432/commute_ng
JWT_SECRET=CHANGE_ME_TO_A_STRONG_SECRET
PORT=3001
NODE_ENV=production
FRONTEND_BASE_URL=http://YOUR_EC2_PUBLIC_IP
OAUTH_CALLBACK_BASE_URL=http://YOUR_EC2_PUBLIC_IP

# Resend (email)
RESEND_API_KEY=CHANGE_ME
RESEND_FROM=noreply@commuteng.com

# Google OAuth (optional for MVP)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# PostgreSQL (must match docker-compose.prod.yml)
POSTGRES_PASSWORD=commuteng_prod
ENVEOF
    echo ""
    echo "⚠️  Created .env template. Edit commute-ng-backend/.env with your actual values."
fi

# Initial build and start
echo "--- Building and starting containers ---"
docker compose down 2>/dev/null || true
docker compose build --no-cache
docker compose up -d

# Wait for health
echo "--- Waiting for services ---"
sleep 15
docker compose ps

echo ""
echo "=== Setup complete ==="
echo "Backend: http://YOUR_EC2_IP:3001"
echo "Frontend: http://YOUR_EC2_IP"
echo ""
echo "Next steps:"
echo "1. Edit commute-ng-backend/.env with your actual secrets"
echo "2. Run: docker compose down && docker compose up -d"
echo "3. Open port 80 and 3001 in AWS security group if not already open"
