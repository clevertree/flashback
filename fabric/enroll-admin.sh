#!/bin/bash

# Enroll CA Admin User
# This script enrolls the admin user with the Fabric CA

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CA_URL="http://localhost:7054"
ADMIN_USER="admin"
ADMIN_PASS="adminpw"
ORG_NAME="org1"
ORG_DOMAIN="org1.flashback.local"

echo "Enrolling CA Admin User..."
echo "CA URL: ${CA_URL}"
echo "Admin User: ${ADMIN_USER}"

# Create wallet directory
mkdir -p "${SCRIPT_DIR}/wallet"

# Note: This is a simplified enrollment example
# In production, use fabric-ca-client for proper enrollment
echo "Placeholder for CA admin enrollment"
echo "In production, use: fabric-ca-client enroll -u http://admin:adminpw@ca.org1.flashback.local:7054"

# Store credentials for later use
cat > "${SCRIPT_DIR}/.env.local" << EOF
CA_URL=${CA_URL}
ADMIN_USER=${ADMIN_USER}
ADMIN_PASS=${ADMIN_PASS}
ORG_NAME=${ORG_NAME}
ORG_DOMAIN=${ORG_DOMAIN}
EOF

echo "Admin enrollment credentials saved to .env.local"
echo "Next step: Register application user with ./register-user.sh"
