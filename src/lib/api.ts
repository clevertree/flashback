import { invoke } from '@tauri-apps/api/tauri';
import {
  loadKaleidoConfig,
  getGatewayUrl,
  getCaUrl,
  getAuthCredentials,
  getOrganizationMspId,
} from './kaleido-config';

/**
 * Get Kaleido configuration
 */
export function getKaleidoConfig() {
  return loadKaleidoConfig();
}

/**
 * Generate a keypair with organization context from Kaleido config
 */
export async function generateKeypair() {
  const config = getKaleidoConfig();
  return invoke('generate_keypair', {
    org_name: config.organization,
  });
}

export async function loadIdentity(path: string) {
  return invoke('load_identity', { path });
}

export async function saveIdentity(path: string, identity: any) {
  return invoke('save_identity', { path, identity });
}

/**
 * Connect to Kaleido network with provided or default configuration
 */
export async function connectNetwork(
  gateway?: string,
  caUrl?: string,
  identity?: any
) {
  const config = getKaleidoConfig();
  const credentials = getAuthCredentials();

  return invoke('connect_network', {
    gateway: gateway || getGatewayUrl(),
    ca_url: caUrl || getCaUrl(),
    identity_json: identity,
    app_id: credentials.username,
    app_password: credentials.password,
    channel_name: config.channelName,
    organization: config.organization,
    connection_timeout_ms: config.connectionTimeoutMs,
  });
}

export async function getChannels() {
  return invoke('get_channels');
}

export async function queryChaincodeAsync(
  channelId: string,
  chaincodeId: string,
  fn: string,
  args: string[]
) {
  return invoke('query_chaincode', {
    channel_id: channelId,
    chaincode_id: chaincodeId,
    function: fn,
    args,
  });
}

export async function invokeChaincodeAsync(
  channelId: string,
  chaincodeId: string,
  fn: string,
  args: string[]
) {
  return invoke('invoke_chaincode', {
    channel_id: channelId,
    chaincode_id: chaincodeId,
    function: fn,
    args,
  });
}

export async function addTorrent(magnetLink: string, outputPath: string) {
  return invoke('add_torrent', {
    magnet_link: magnetLink,
    output_path: outputPath,
  });
}

export async function getTorrentProgress(hash: string) {
  return invoke('get_torrent_progress', { hash });
}
