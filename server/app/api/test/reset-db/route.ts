import {NextRequest, NextResponse} from 'next/server';
import {initDatabase, UserModel} from '@/db/models';
import {Op} from "sequelize";


export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    // Environment check
    const isTestMode =
        process.env.NODE_ENV === 'test' ||
        process.env.CYPRESS_RESET_DB === 'true' ||
        process.env.TEST_MODE === 'true';

    if (!isTestMode) {
        return NextResponse.json({
            error: 'Not allowed in non-test environment'
        }, {status: 403});
    }

    try {
        await initDatabase();

        // Delete only test users (with email pattern test*@test.com)
        await UserModel.destroy({
            where: {
                email: {
                    [Op.like]: 'test%@test.com'
                }
            }
        });

        return NextResponse.json({
            status: 'Test users deleted successfully'
        });
    } catch (err) {
        console.error('Database reset error', err);
        return NextResponse.json({
            error: 'Database reset failed',
            details: err instanceof Error ? err.message : 'Unknown error'
        }, {status: 500});
    }
}
