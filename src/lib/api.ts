import { invoke } from '@tauri-apps/api/tauri';

export async function generateKeypair() {
  return invoke('generate_keypair');
}

export async function loadIdentity(path: string) {
  return invoke('load_identity', { path });
}

export async function saveIdentity(path: string, identity: any) {
  return invoke('save_identity', { path, identity });
}

export async function connectNetwork(
  gateway: string,
  caUrl: string,
  identity: any
) {
  return invoke('connect_network', {
    gateway,
    ca_url: caUrl,
    identity_json: identity,
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
