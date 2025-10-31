import 'reflect-metadata';
import {NextRequest, NextResponse} from 'next/server';
import {initDatabase, BroadcastModel, UserModel} from '@/db/models';
import {requireMutualTLS} from '@/lib/auth';
import {startRelayCleanupJob} from '@/lib/cleanup';
import {Op} from 'sequelize';

export const runtime = 'nodejs';
startRelayCleanupJob();

export async function GET(req: NextRequest) {
  try {
    await initDatabase();

    const auth = await requireMutualTLS(req);
    if (auth instanceof NextResponse) return auth;

    const {searchParams} = new URL(req.url);
    const email = searchParams.get('email');
    if (!email) return NextResponse.json({error: 'Missing email'}, {status: 400});

    const target = await UserModel.findOne({where: {email}});
    if (!target) return NextResponse.json({error: 'Peer not found or offline'}, {status: 404});

    const now = new Date();
    const broadcast = await BroadcastModel.findOne({
      where: {user_id: target.id, expires_at: {[Op.gt]: now}},
    });

    if (!broadcast) {
      return NextResponse.json({error: 'Peer not found or offline'}, {status: 404});
    }

    return NextResponse.json({
      email,
      port: (broadcast as any).port,
      addresses: (broadcast as any).addresses,
      last_seen: (broadcast as any).last_heartbeat ?? null
    }, {status: 200});
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('/api/relay/broadcast/lookup error', err);
      return NextResponse.json({error: err.message || 'Internal Server Error'}, {status: 500});
    }
    throw err;
  }
}
