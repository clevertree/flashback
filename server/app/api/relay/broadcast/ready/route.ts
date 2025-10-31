import 'reflect-metadata';
import {NextRequest, NextResponse} from 'next/server';
import {initDatabase, BroadcastModel} from '@/db/models';
import {requireMutualTLS} from '@/lib/auth';
import {startRelayCleanupJob} from '@/lib/cleanup';

export const runtime = 'nodejs';
startRelayCleanupJob();

interface Body {
  port: number;
  addresses: string[];
  capabilities?: Record<string, any> | null;
}

export async function POST(req: NextRequest) {
  try {
    await initDatabase();

    const auth = await requireMutualTLS(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) return NextResponse.json({error: 'Invalid JSON body'}, {status: 400});

    const {port, addresses, capabilities} = body;

    if (!port || typeof port !== 'number' || port < 1 || port > 65535) {
      return NextResponse.json({error: 'Invalid port'}, {status: 400});
    }
    if (!Array.isArray(addresses) || addresses.length === 0 || !addresses.every(a => typeof a === 'string')) {
      return NextResponse.json({error: 'Invalid addresses'}, {status: 400});
    }

    // compute expiration 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Upsert single broadcast per user
    let record = await BroadcastModel.findOne({where: {user_id: auth.user.id}});
    if (record) {
      record.port = port;
      record.addresses = addresses as any;
      (record as any).capabilities = capabilities ?? null;
      record.expires_at = expiresAt;
      await record.save();
    } else {
      record = await BroadcastModel.create({
        user_id: auth.user.id,
        port,
        addresses: addresses as any,
        capabilities: (capabilities ?? null) as any,
        expires_at: expiresAt
      } as any);
    }

    return NextResponse.json({broadcast_id: record.id, expires_in: 3600}, {status: 200});
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('/api/relay/broadcast/ready error', err);
      return NextResponse.json({error: err.message || 'Internal Server Error'}, {status: 500});
    }
    throw err;
  }
}
