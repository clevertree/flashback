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
  serverPort: Number(app.node.tryGetContext('serverPort') || 51111),
  ecrRepoName: app.node.tryGetContext('ecrRepoName') || 'flashback-server',
  imageTag: app.node.tryGetContext('imageTag') || 'latest',
  desiredCount: Number(app.node.tryGetContext('desiredCount') || 1),
  cpu: Number(app.node.tryGetContext('cpu') || 256),
  memoryMiB: Number(app.node.tryGetContext('memoryMiB') || 512),
});
