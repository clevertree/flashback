# Hyperledger Fabric Network Setup Guide

This directory contains the configuration and scripts for setting up a local Hyperledger Fabric network for the Flashback application.

## Overview

The Fabric network consists of:
- **Orderer**: Single orderer node managing the blockchain
- **Peer**: Peer node for executing chaincode and storing ledger
- **CA (Certificate Authority)**: For user registration and certificate management
- **CouchDB**: State database for storing ledger data
- **CLI**: Command-line interface for network management

## Prerequisites

1. **Docker & Docker Compose**: Install from [docker.com](https://docker.com)
   ```bash
   docker --version
   docker-compose --version
   ```

2. **Fabric Binaries** (Optional for production):
   ```bash
   curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0
   ```

3. **Go** (for chaincode development):
   ```bash
   go version  # Should be 1.21 or higher
   ```

## Quick Start

### 1. Start the Fabric Network

```bash
cd fabric/
chmod +x setup.sh enroll-admin.sh register-user.sh create-channel.sh
./setup.sh
```

This will:
- Create necessary directories
- Pull Docker images (first run only)
- Start all containers
- Display network status

### 2. Enroll Admin User

```bash
./enroll-admin.sh
```

### 3. Create Channel

```bash
./create-channel.sh flashback
```

### 4. Deploy Chaincode

```bash
./deploy-chaincode.sh entries 1.0
```

## Network Configuration

### Orderer Configuration
- **Container**: `orderer.flashback.local`
- **Port**: 7050 (gRPC)
- **Consensus**: etcdraft (crash-tolerant)
- **Genesis Block**: Generated from `configtx.yaml`

### Peer Configuration
- **Container**: `peer0.org1.flashback.local`
- **Port**: 7051 (gRPC)
- **Chaincode Port**: 7052
- **MSP ID**: Org1MSP
- **State DB**: CouchDB

### CA Configuration
- **Container**: `ca.org1.flashback.local`
- **Port**: 7054 (REST API)
- **Admin User**: admin
- **Admin Password**: adminpw

### CouchDB Configuration
- **Container**: `couchdb.org1.flashback.local`
- **Port**: 5984 (HTTP)
- **Username**: admin
- **Password**: password
- **Data Dir**: `./couchdb_data`

## File Structure

```
fabric/
├── docker-compose.yml          # Container definitions
├── crypto-config.yaml          # Cryptographic material configuration
├── configtx.yaml              # Channel configuration
├── setup.sh                   # Main setup script
├── enroll-admin.sh            # Admin enrollment script
├── register-user.sh           # User registration script
├── create-channel.sh          # Channel creation script
├── deploy-chaincode.sh        # Chaincode deployment script
├── README.md                  # This file
├── crypto-config/             # Generated certificates and keys
├── channel_artifacts/         # Generated channel artifacts
├── ca_server/                 # CA server data
├── peer_msp/                  # Peer MSP configuration
├── peer_tls/                  # Peer TLS certificates
├── orderer_msp/               # Orderer MSP configuration
├── orderer_tls/               # Orderer TLS certificates
├── cli_scripts/               # CLI management scripts
└── wallet/                    # Stored credentials
```

## Common Commands

### View Network Status
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f peer0.org1.flashback.local
docker-compose logs -f orderer.flashback.local
docker-compose logs -f ca.org1.flashback.local
```

### Access CLI Container
```bash
docker-compose exec cli bash
```

### Stop Network
```bash
docker-compose down
```

### Remove Network (and data)
```bash
docker-compose down -v
```

## Chaincode Lifecycle

### 1. Package Chaincode
```bash
peer lifecycle chaincode package entries.tar.gz --path /path/to/chaincode --label entries_1.0
```

### 2. Install Chaincode
```bash
peer lifecycle chaincode install entries.tar.gz
```

### 3. Approve for Organization
```bash
peer lifecycle chaincode approveformyorg \
  --channelID flashback \
  --name entries \
  --version 1.0 \
  --package-id entries_1.0:hash
```

### 4. Commit Chaincode
```bash
peer lifecycle chaincode commit \
  --channelID flashback \
  --name entries \
  --version 1.0 \
  --sequence 1
```

## Invoking Chaincode

### Submit Transaction
```bash
peer chaincode invoke \
  -C flashback \
  -n entries \
  -c '{"function":"CreateEntry","Args":["repo1","title","content","author","1699000000"]}'
```

### Query Ledger
```bash
peer chaincode query \
  -C flashback \
  -n entries \
  -c '{"function":"GetEntry","Args":["entry-id"]}'
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs orderer.flashback.local

# Restart containers
docker-compose restart

# Remove and restart
docker-compose down && docker-compose up -d
```

### Genesis block issues
```bash
# Regenerate genesis block
rm -rf channel_artifacts/
./create-channel.sh flashback
```

### CouchDB connection issues
```bash
# Check CouchDB is running
docker-compose ps couchdb.org1.flashback.local

# Verify connection
curl http://localhost:5984/
```

### Certificate issues
```bash
# Clear crypto materials
rm -rf crypto-config/

# Regenerate
./setup.sh
```

## Advanced Configuration

### Adding Another Organization
Edit `crypto-config.yaml` to add another `PeerOrgs` entry:
```yaml
  - Name: Org2
    Domain: org2.flashback.local
    ...
```

### Changing Batch Timeout
Edit `configtx.yaml`:
```yaml
Orderer:
  BatchTimeout: 2s  # Adjust as needed
```

### Custom Endorsement Policy
Modify chaincode lifecycle approval with different `-P` policy flags:
```bash
peer lifecycle chaincode approveformyorg \
  -P "OR('Org1MSP.peer')" \
  ...
```

## Performance Tuning

### CouchDB Performance
- Increase JVM memory: `COUCHDB_MEMORY_MB=4096`
- Enable compression: `COUCHDB_COMPRESSION=true`
- Adjust batch size in orderer

### Peer Performance
- Increase thread count: `CORE_CHAINCODE_EXECUTETIMEOUT=30s`
- Adjust block size: `BatchSize.MaxMessageCount`

## Security Notes

⚠️ **Development Only**: This setup is for development and testing only. For production:

1. Generate proper cryptographic materials with `cryptogen`
2. Use TLS certificates from trusted CAs
3. Implement proper access control
4. Use organization-specific MSP configurations
5. Enable authentication on all components
6. Use production-grade orderer consensus

## Testing the Network

### 1. Create a test entry
```bash
./deploy-chaincode.sh entries 1.0
peer chaincode invoke -C flashback -n entries \
  -c '{"function":"CreateEntry","Args":["repo-name","test-title","test content","user@example.com","1699000000"]}'
```

### 2. Query the entry
```bash
peer chaincode query -C flashback -n entries \
  -c '{"function":"GetEntry","Args":["entry-id"]}'
```

### 3. List all entries
```bash
peer chaincode query -C flashback -n entries \
  -c '{"function":"ListEntries","Args":["repo-name","",""]}'
```

## Integration with Flashback Client

The Tauri client connects to Fabric using:
- **Peer Address**: `peer0.org1.flashback.local:7051`
- **Orderer Address**: `orderer.flashback.local:7050`
- **CA Address**: `ca.org1.flashback.local:7054`
- **Channel**: `flashback`
- **Chaincode**: `entries`, `comments`, `ratings`

See `/client/src-tauri/src/commands/fabric/` for integration code.

## Next Steps

1. Deploy chaincode for entries management
2. Set up chaincode for comments
3. Implement rating system chaincode
4. Connect Tauri client to real Fabric network
5. Test end-to-end transaction flow

## References

- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)
- [Fabric Samples](https://github.com/hyperledger/fabric-samples)
- [Fabric Chaincode Development](https://hyperledger-fabric.readthedocs.io/en/latest/developapps/smartcontract.html)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
