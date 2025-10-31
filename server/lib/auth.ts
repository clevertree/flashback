import {NextRequest, NextResponse} from 'next/server';
import {UserModel} from '@/db/models';
import {getClientCertificateFromHeaders, normalizePEM} from '@/lib/cert';

export interface AuthedUser {
  user: UserModel;
  certificate: string;
}

/**
 * Validates mutual TLS by extracting the forwarded client certificate from headers
 * and matching it to a registered user in the database.
 *
 * Returns {user, certificate} if valid, or a NextResponse if unauthorized.
 */
export async function requireMutualTLS(req: NextRequest): Promise<AuthedUser | NextResponse> {
  const cert = getClientCertificateFromHeaders(req);
  if (!cert) return NextResponse.json({error: 'Unauthorized: missing client certificate'}, {status: 401});

  const normalized = normalizePEM(cert);
  const user = await UserModel.findOne({where: {certificate: normalized}});
  if (!user) return NextResponse.json({error: 'Unauthorized: certificate not registered'}, {status: 401});

  return {user, certificate: normalized};
}
