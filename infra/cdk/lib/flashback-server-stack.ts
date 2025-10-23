import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

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
# Prepare directories
mkdir -p /opt/flashback
cd /opt/flashback

# Install dependencies
yum update -y || true
yum install -y git gcc openssl-devel pkgconfig systemd || true
# Install Rust (non-interactive)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source /root/.cargo/env

# Write config.toml
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
/root/.cargo/bin/cargo build --release

# Create systemd service
cat > /etc/systemd/system/flashback-server.service <<'SVC'
[Unit]
Description=Flashback Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/flashback/repo/server
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
systemctl restart flashback-server
`;

    const instance = new ec2.Instance(this, 'FlashbackServer', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(props.instanceType || 't3.small'),
      machineImage: ami,
      securityGroup: sg,
      keyName: props.keyName,
      detailedMonitoring: true,
    });

    // Configure spot instance options
    const cfnInstance = instance.node.defaultChild as ec2.CfnInstance;
    cfnInstance.instanceMarketOptions = {
      marketType: 'spot',
      spotOptions: {
        spotInstanceType: 'one-time',
      },
    } as any;

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
      healthCheck: { protocol: elbv2.Protocol.TCP },
    });
    tg.addTarget(instance);

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
