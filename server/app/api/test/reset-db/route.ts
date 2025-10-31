import 'reflect-metadata';
import {NextRequest, NextResponse} from 'next/server';
import {initDatabase, sequelize, BroadcastModel, BroadcastSourceModel, UserModel, RepositoryModel} from '@/db/models';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest) {
  try {
    const isTest = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true' || process.env.CYPRESS_RESET_DB === 'true';
    if (!isTest) {
      return NextResponse.json({error: 'Reset allowed only in test mode'}, {status: 403});
    }
    await initDatabase();

    // Truncate tables in dependency order
    await BroadcastModel.destroy({where: {}, truncate: true, cascade: true, force: true});
    await BroadcastSourceModel.destroy({where: {}, truncate: true, cascade: true, force: true});
    await UserModel.destroy({where: {}, truncate: true, cascade: true, force: true});
    await RepositoryModel.destroy({where: {}, truncate: true, cascade: true, force: true});

    // Reset sequences (best effort)
    try {
      await sequelize.query("SELECT setval(pg_get_serial_sequence('broadcast','id'), 1, false)");
      await sequelize.query("SELECT setval(pg_get_serial_sequence('broadcast_source','id'), 1, false)");
      await sequelize.query("SELECT setval(pg_get_serial_sequence('user','id'), 1, false)");
      await sequelize.query("SELECT setval(pg_get_serial_sequence('repository','id'), 1, false)");
    } catch {}

    return NextResponse.json({status: 'Test users deleted successfully'}, {status: 200});
  } catch (e: any) {
    console.error('/api/test/reset-db error', e);
    return NextResponse.json({error: e?.message || 'Internal Server Error'}, {status: 500});
  }
}
