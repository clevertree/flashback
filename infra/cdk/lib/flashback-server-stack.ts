import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2Targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';

export interface FlashbackServerStackProps extends cdk.StackProps {
  instanceType?: string; // e.g., t3.small
  sshCidr?: string; // e.g., 0.0.0.0/0
  repoUrl: string;
  branch: string;
  serverPort: number; // default server port, e.g., 51111
  keyName?: string; // optional existing EC2 key pair name
}

export class FlashbackServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FlashbackServerStackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    const sg = new ec2.SecurityGroup(this, 'FlashbackSg', {
      vpc,
      description: 'Flashback server SG',
      allowAllOutbound: true,
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(props.serverPort), `Allow Flashback server port ${props.serverPort}`);
    sg.addIngressRule(ec2.Peer.ipv4(props.sshCidr || '0.0.0.0/0'), ec2.Port.tcp(22), 'Allow SSH');

    const ami = ec2.MachineImage.latestAmazonLinux({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
      cpuType: ec2.AmazonLinuxCpuType.X86_64,
    });

    const userDataScript = `#!/bin/bash
set -euxo pipefail

# Log bootstrap to a file for troubleshooting
LOGFILE=/var/log/flashback-bootstrap.log
mkdir -p /var/log
exec > >(tee -a "$LOGFILE") 2>&1

echo "[flashback] Starting bootstrap at $(date -Is)"

# Prepare directories
mkdir -p /opt/flashback
cd /opt/flashback

# Install dependencies (Amazon Linux 2023)
dnf -y update || true
dnf -y install git gcc gcc-c++ make openssl-devel pkgconf-pkg-config systemd || true

# Install Rust (non-interactive)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source /root/.cargo/env

# Write config.toml (server reads from CWD; we'll set WorkingDirectory to /opt/flashback)
cat > /opt/flashback/config.toml <<'CFG'
[server]
port = ${props.serverPort}
heartbeat_interval = 60
connection_timeout = 120
host = "0.0.0.0"
max_clients = 100
CFG

# Clone or update repo
if [ ! -d "/opt/flashback/repo/.git" ]; then
  git clone --branch ${props.branch} ${props.repoUrl} /opt/flashback/repo
else
  cd /opt/flashback/repo
  git fetch origin ${props.branch}
  git checkout ${props.branch}
  git reset --hard origin/${props.branch}
fi

cd /opt/flashback/repo/server
# Build server (release)
/root/.cargo/bin/cargo build --release | tee -a "$LOGFILE"

# Create systemd service
cat > /etc/systemd/system/flashback-server.service <<'SVC'
[Unit]
Description=Flashback Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/flashback
ExecStart=/opt/flashback/repo/server/target/release/server
Environment=RUST_LOG=info
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC

# Enable and start service
systemctl daemon-reload
systemctl enable flashback-server
systemctl restart flashback-server || (journalctl -u flashback-server -n 200 --no-pager; exit 1)

# Post-start smoke check: ensure server is listening on ${props.serverPort}
for i in $(seq 1 30); do
  if ss -ltnp | grep -q ":${props.serverPort} "; then
    echo "[flashback] Server is listening on port ${props.serverPort}"
    break
  fi
  echo "[flashback] Waiting for server to listen on ${props.serverPort} (attempt $i)"
  sleep 2
  if [ "$i" -eq 30 ]; then
    echo "[flashback] ERROR: Server not listening on ${props.serverPort} after timeout"
    systemctl status flashback-server --no-pager || true
    exit 1
  fi
done

ss -ltnp || true

echo "[flashback] Bootstrap complete at $(date -Is)"`;

    const instance = new ec2.Instance(this, 'FlashbackServer', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(props.instanceType || 't3.small'),
      machineImage: ami,
      securityGroup: sg,
      keyName: props.keyName,
      detailedMonitoring: true,
    });

    // Configure Spot capacity via low-level override (typing varies by CDK version)
    const cfnInstance = instance.node.defaultChild as ec2.CfnInstance;
    (cfnInstance as any).instanceMarketOptions = {
      marketType: 'spot',
      spotOptions: { spotInstanceType: 'one-time' },
    };

    instance.addUserData(userDataScript);

    // Allocate and associate an Elastic IP
    const eip = new ec2.CfnEIP(this, 'FlashbackEip');
    new ec2.CfnEIPAssociation(this, 'FlashbackEipAssociation', {
      allocationId: eip.attrAllocationId,
      instanceId: instance.instanceId,
    });

    // Network Load Balancer to provide a stable DNS name (no Route53 required)
    const nlb = new elbv2.NetworkLoadBalancer(this, 'FlashbackNlb', {
      vpc,
      internetFacing: true,
    });

    const tg = new elbv2.NetworkTargetGroup(this, 'FlashbackTg', {
      vpc,
      port: props.serverPort,
      protocol: elbv2.Protocol.TCP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        protocol: elbv2.Protocol.TCP,
        port: String(props.serverPort),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
        interval: cdk.Duration.seconds(10),
        timeout: cdk.Duration.seconds(6),
      },
    });
    tg.addTarget(new elbv2Targets.InstanceTarget(instance, props.serverPort));

    new elbv2.NetworkListener(this, 'FlashbackListener', {
      loadBalancer: nlb,
      port: props.serverPort,
      protocol: elbv2.Protocol.TCP,
      defaultTargetGroups: [tg],
    });

    new cdk.CfnOutput(this, 'NlbDnsName', { value: nlb.loadBalancerDnsName });
    new cdk.CfnOutput(this, 'ServerPort', { value: props.serverPort.toString() });
  }
}
