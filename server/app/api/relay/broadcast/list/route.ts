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

    const now = new Date();
    const rows = await BroadcastModel.findAll({
      where: {
        expires_at: {[Op.gt]: now},
        user_id: {[Op.ne]: auth.user.id}
      },
      include: [{model: UserModel, attributes: ['email']}],
      order: [[{model: UserModel, as: 'user'} as any, 'email', 'ASC']]
    } as any);

    const out = rows.map(row => ({
      email: (row as any).user?.email,
      port: (row as any).port,
      addresses: (row as any).addresses
    }));

    return NextResponse.json(out, {status: 200});
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('/api/relay/broadcast/list error', err);
      return NextResponse.json({error: err.message || 'Internal Server Error'}, {status: 500});
    }
    throw err;
  }
}
