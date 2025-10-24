#!/usr/bin/env bash
set -euo pipefail

# Cleanup legacy ECS Application Auto Scaling target/policies that may block CDK deploys
# Usage:
#   scripts/cleanup-autoscaling.sh <OLD_RESOURCE_ID> [region]
# Example OLD_RESOURCE_ID from error:
#   service/FlashbackServerStack-FlashbackClusterA8268E97-GzFmQgtelggI/FlashbackServerStack-FlashbackService23399868-BH8R49HOhGnS
#
# Notes:
# - Region defaults to us-east-1
# - This script is idempotent; if nothing is found, it exits successfully

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <OLD_RESOURCE_ID> [region]" >&2
  exit 1
fi

OLD_RESOURCE_ID="$1"
AWS_REGION="${2:-${AWS_REGION:-us-east-1}}"
STACK="${STACK:-FlashbackServerStack}"

export AWS_REGION

echo "[+] Region: $AWS_REGION"
echo "[+] Stack : $STACK"
echo "[+] Old ResourceId: $OLD_RESOURCE_ID"

# Optional visibility into stack resources
if command -v aws >/dev/null 2>&1; then
  echo "[i] Describing stack scalable targets (if any)"
  aws cloudformation describe-stack-resources \
    --stack-name "$STACK" \
    --query "StackResources[?ResourceType=='AWS::ApplicationAutoScaling::ScalableTarget'].[LogicalResourceId,PhysicalResourceId,ResourceStatus]" \
    --output table \
    --region "$AWS_REGION" || true
else
  echo "[!] AWS CLI not found in PATH" >&2
  exit 2
fi

# Check if the legacy ScalableTarget exists
FOUND=$(aws application-autoscaling describe-scalable-targets \
  --service-namespace ecs \
  --region "$AWS_REGION" \
  --query "length(ScalableTargets[?ResourceId=='$OLD_RESOURCE_ID'])")

if [[ "$FOUND" == "0" ]]; then
  echo "[✓] No lingering scalable target found for $OLD_RESOURCE_ID in $AWS_REGION"
else
  echo "[!] Found lingering scalable target. Cleaning attached scaling policies..."
  POLICIES=$(aws application-autoscaling describe-scaling-policies \
    --service-namespace ecs \
    --region "$AWS_REGION" \
    --query "ScalingPolicies[?ResourceId=='$OLD_RESOURCE_ID'].PolicyName" \
    --output text)

  if [[ -n "${POLICIES}" ]]; then
    for p in $POLICIES; do
      echo "[-] Deleting policy: $p"
      aws application-autoscaling delete-scaling-policy \
        --service-namespace ecs \
        --resource-id "$OLD_RESOURCE_ID" \
        --scalable-dimension ecs:service:DesiredCount \
        --policy-name "$p" \
        --region "$AWS_REGION" || true
    done
  else
    echo "[i] No policies attached"
  fi

  echo "[-] Deregistering scalable target: $OLD_RESOURCE_ID"
  aws application-autoscaling deregister-scalable-target \
    --service-namespace ecs \
    --resource-id "$OLD_RESOURCE_ID" \
    --scalable-dimension ecs:service:DesiredCount \
    --region "$AWS_REGION" || true
fi

echo "[✓] Cleanup complete. You can now redeploy CDK (resource uses stable names: service/flashback-cluster/flashback-svc)."
