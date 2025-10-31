import 'reflect-metadata';
import {NextRequest, NextResponse} from 'next/server';
import {initDatabase, UserModel} from '@/db/models';
import {parseCertWithNodeCrypto} from '@db/keyUtils';
import {normalizePEM} from '@/lib/cert';
import {startRelayCleanupJob} from '@/lib/cleanup';

export const runtime = 'nodejs';

// ensure cleanup job is running when relay API is used
startRelayCleanupJob();

interface Body {
  certificate: string;
}

export async function POST(req: NextRequest) {
  try {
    await initDatabase();

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) return NextResponse.json({error: 'Invalid JSON body'}, {status: 400});

    const {certificate} = body;
    if (!certificate) return NextResponse.json({error: 'Missing fields: certificate'}, {status: 400});

    let email: string | undefined;
    let normalizedCert = '';
    try {
      normalizedCert = normalizePEM(certificate);
      ({email} = parseCertWithNodeCrypto(normalizedCert));
    } catch (e: any) {
      return NextResponse.json({error: 'Invalid certificate'}, {status: 400});
    }
    if (!email) return NextResponse.json({error: 'Invalid certificate: missing email'}, {status: 400});

    const existing = await UserModel.findOne({where: {email}});
    if (existing) {
      return NextResponse.json({error: 'Email already registered'}, {status: 409});
    }

    await UserModel.create({email, certificate: normalizedCert});
    return NextResponse.json({email}, {status: 200});
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('/api/relay/register error', err);
      return NextResponse.json({error: err.message || 'Internal Server Error'}, {status: 500});
    }
    throw err;
  }
}
