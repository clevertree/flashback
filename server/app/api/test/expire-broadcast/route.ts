import 'reflect-metadata';
import {NextRequest, NextResponse} from 'next/server';
import {initDatabase, BroadcastModel, UserModel} from '@/db/models';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const isTest = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true' || process.env.CYPRESS_RESET_DB === 'true';
    if (!isTest) {
      return NextResponse.json({error: 'Expire allowed only in test mode'}, {status: 403});
    }
    await initDatabase();

    const body = await req.json().catch(() => (null as any)) as { email?: string } | null;
    const email = body?.email;
    if (!email) return NextResponse.json({error: 'Missing email'}, {status: 400});

    const user = await UserModel.findOne({where: {email}});
    if (!user) return NextResponse.json({error: 'User not found'}, {status: 404});

    const rec = await BroadcastModel.findOne({where: {user_id: user.id}});
    if (!rec) return NextResponse.json({error: 'Broadcast not found'}, {status: 404});

    rec.expires_at = new Date(Date.now() - 1000);
    await rec.save();

    return NextResponse.json({status: 'expired'}, {status: 200});
  } catch (e: any) {
    console.error('/api/test/expire-broadcast error', e);
    return NextResponse.json({error: e?.message || 'Internal Server Error'}, {status: 500});
  }
}
