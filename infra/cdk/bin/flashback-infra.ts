#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FlashbackServerStack } from '../lib/flashback-server-stack';

const app = new cdk.App();

// Context/Env variables
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

new FlashbackServerStack(app, 'FlashbackServerStack', {
  env,
  // Provide defaults; allow overrides via context/CLI
  instanceType: app.node.tryGetContext('instanceType') || 't3.small',
  sshCidr: app.node.tryGetContext('sshCidr') || '0.0.0.0/0',
  repoUrl: app.node.tryGetContext('repoUrl') || 'https://github.com/your-user/flashback.git',
  branch: app.node.tryGetContext('branch') || 'main',
  serverPort: Number(app.node.tryGetContext('serverPort') || 51111),
  keyName: app.node.tryGetContext('keyName'), // optional existing EC2 key pair name
});
