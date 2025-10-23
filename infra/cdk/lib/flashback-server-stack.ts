import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export interface FlashbackServerStackProps extends cdk.StackProps {
  serverPort: number; // default server port, e.g., 51111
  ecrRepoName: string; // ECR repository name containing server image
  imageTag: string; // image tag to deploy
  desiredCount?: number; // number of tasks
  cpu?: number; // Fargate CPU units (e.g., 256, 512, 1024)
  memoryMiB?: number; // Fargate memory (e.g., 512, 1024, 2048)
}

export class FlashbackServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FlashbackServerStackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // Security group for ECS tasks: allow inbound server traffic from the internet (via NLB)
    const svcSg = new ec2.SecurityGroup(this, 'FlashbackSvcSg', {
      vpc,
      description: 'Flashback ECS service SG',
      allowAllOutbound: true,
    });
    svcSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(props.serverPort), `Allow Flashback server port ${props.serverPort}`);

    // Network Load Balancer
    const nlb = new elbv2.NetworkLoadBalancer(this, 'FlashbackNlb', {
      vpc,
      internetFacing: true,
    });

    // Target group must be IP for Fargate
    const tg = new elbv2.NetworkTargetGroup(this, 'FlashbackTg', {
      vpc,
      port: props.serverPort,
      protocol: elbv2.Protocol.TCP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        protocol: elbv2.Protocol.TCP,
        port: String(props.serverPort),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
        interval: cdk.Duration.seconds(10),
        timeout: cdk.Duration.seconds(6),
      },
    });

    new elbv2.NetworkListener(this, 'FlashbackListener', {
      loadBalancer: nlb,
      port: props.serverPort,
      protocol: elbv2.Protocol.TCP,
      defaultTargetGroups: [tg],
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'FlashbackCluster', { vpc });

    // Task definition
    const cpu = props.cpu ?? 256; // 0.25 vCPU
    const memoryMiB = props.memoryMiB ?? 512; // 0.5 GB
    const taskDef = new ecs.FargateTaskDefinition(this, 'FlashbackTaskDef', {
      cpu,
      memoryLimitMiB: memoryMiB,
    });

    const repository = ecr.Repository.fromRepositoryName(this, 'FlashbackRepo', props.ecrRepoName);
    const image = ecs.ContainerImage.fromEcrRepository(repository, props.imageTag);

    const container = taskDef.addContainer('FlashbackContainer', {
      image,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'flashback' }),
      environment: { RUST_LOG: 'info' },
    });

    container.addPortMappings({ containerPort: props.serverPort, protocol: ecs.Protocol.TCP });

    // Fargate Service
    const service = new ecs.FargateService(this, 'FlashbackService', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: props.desiredCount ?? 1,
      assignPublicIp: true,
      securityGroups: [svcSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // Attach service to NLB target group
    service.attachToNetworkTargetGroup(tg);

    new cdk.CfnOutput(this, 'NlbDnsName', { value: nlb.loadBalancerDnsName });
    new cdk.CfnOutput(this, 'ServerPort', { value: props.serverPort.toString() });
  }
}
