/**
 * Kaleido REST Gateway API Client
 * Direct API calls to Kaleido REST Gateway for chaincode invocation
 * 
 * Usage:
 * - For queries: const result = await queryChaincode('QueryAll', []);
 * - For transactions: const result = await invokeChaincode('SubmitContentRequest', [movieData]);
 */

import { loadKaleidoConfig, getAuthCredentials } from './kaleido-config';

interface ChaincodeResponse {
  result: any;
  status: number;
  txid?: string;
  error?: string;
}

interface ChaincodeInvokeResult {
  transactionID: string;
  status: string;
  payload: any;
}

/**
 * Get basic auth header from Kaleido credentials
 */
function getAuthHeader(): string {
  const credentials = getAuthCredentials();
  const encodedCreds = Buffer.from(
    `${credentials.username}:${credentials.password}`
  ).toString('base64');
  return `Basic ${encodedCreds}`;
}

/**
 * Make a request to Kaleido REST Gateway
 */
async function makeRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: any
): Promise<ChaincodeResponse> {
  const config = loadKaleidoConfig();
  const url = `${config.restGateway}${path}`;
  const auth = getAuthHeader();

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error(`Kaleido API error (${response.status}):`, data);
      return {
        result: null,
        status: response.status,
        error: data.message || `HTTP ${response.status}`,
      };
    }

    return {
      result: data,
      status: response.status,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Kaleido API request failed:', errorMsg);
    return {
      result: null,
      status: 0,
      error: errorMsg,
    };
  }
}

/**
 * Query a chaincode (read-only operation)
 */
export async function queryChaincode(
  fn: string,
  args: string[] = []
): Promise<ChaincodeResponse> {
  const config = loadKaleidoConfig();
  const chaincodeId = 'movie';

  // Format args for query
  const queryArgs = args.length > 0 ? `&args=[${args.map(a => `"${a}"`).join(',')}]` : '';
  const path = `/channels/${config.channelName}/chaincodes/${chaincodeId}?args=["${fn}"${queryArgs}]`;

  return makeRequest('GET', path);
}

/**
 * Invoke a chaincode (write operation)
 */
export async function invokeChaincode(
  fn: string,
  args: string[] = []
): Promise<ChaincodeResponse> {
  const config = loadKaleidoConfig();
  const chaincodeId = 'movie';

  const body = {
    chaincodeName: chaincodeId,
    args: [fn, ...args],
  };

  const path = `/channels/${config.channelName}/transactions`;
  return makeRequest('POST', path, body);
}

/**
 * Submit content request (invoke)
 */
export async function submitContentRequest(movieData: string): Promise<ChaincodeResponse> {
  return invokeChaincode('SubmitContentRequest', [movieData]);
}

/**
 * Approve content request (invoke)
 */
export async function approveContentRequest(
  imdbId: string,
  moderatorId: string
): Promise<ChaincodeResponse> {
  return invokeChaincode('ApproveContentRequest', [imdbId, moderatorId]);
}

/**
 * Query all movies (query)
 */
export async function queryAllMovies(): Promise<ChaincodeResponse> {
  return queryChaincode('QueryAll', []);
}

/**
 * Get movie by IMDB ID (query)
 */
export async function getMovieByImdbId(imdbId: string): Promise<ChaincodeResponse> {
  return queryChaincode('GetMovieByIMDB', [imdbId]);
}

/**
 * Search movies by title (query)
 */
export async function searchMoviesByTitle(title: string): Promise<ChaincodeResponse> {
  return queryChaincode('SearchByTitle', [title]);
}

/**
 * Get content request history (query)
 */
export async function getRequestHistory(imdbId: string): Promise<ChaincodeResponse> {
  return queryChaincode('GetRequestHistory', [imdbId]);
}

/**
 * Health check - ping the REST Gateway
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const config = loadKaleidoConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${config.restGateway}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    return response.ok;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

/**
 * Get chaincode info (query)
 */
export async function getChaincodeInfo(): Promise<ChaincodeResponse> {
  const config = loadKaleidoConfig();
  const path = `/channels/${config.channelName}/chaincodes/movie`;
  return makeRequest('GET', path);
}

export default {
  queryChaincode,
  invokeChaincode,
  submitContentRequest,
  approveContentRequest,
  queryAllMovies,
  getMovieByImdbId,
  searchMoviesByTitle,
  getRequestHistory,
  healthCheck,
  getChaincodeInfo,
};
