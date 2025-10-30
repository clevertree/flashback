import 'reflect-metadata';
import {NextRequest, NextResponse} from 'next/server';
import {Op} from 'sequelize';
import {BroadcastSourceModel, initDatabase, UserModel} from '@/db/models';

/**
 * Provides a list of recent broadcast sockets for a given user.
 * GET /api/broadcast/lookup?email=...&minutes=10
 */
interface BroadcastLookupQuery {
    email: string;
    minutes?: number; // default 10, clamped 1..1440
}

export async function GET(req: NextRequest) {
    try {
        await initDatabase();
        const {searchParams} = new URL(req.url);
        const q: BroadcastLookupQuery = {
            email: searchParams.get('email') ?? '',
            minutes: (() => {
                const raw = searchParams.get('minutes');
                if (raw == null) return undefined;
                const n = Number.parseInt(raw, 10);
                return Number.isFinite(n) ? Math.max(1, Math.min(1440, n)) : undefined;
            })(),
        };

        if (!q.email) {
            return NextResponse.json({error: 'Missing email'}, {status: 400});
        }

        const minutes = q.minutes ?? 10;
        const since = new Date(Date.now() - minutes * 60 * 1000);

        const user = await UserModel.findOne({where: {email: q.email}});
        if (!user) {
            return NextResponse.json({items: []}, {status: 200});
        }

        // Ensure user.id is valid
        if (!user.id) {
            return NextResponse.json({items: []}, {status: 200});
        }

        const items = await BroadcastSourceModel.findAll({
            where: {
                user_id: user.id as number,
                updatedAt: {[Op.gte]: since},
            },
            order: [['updatedAt', 'DESC']],
        });

        return NextResponse.json({items: items.map(i => i.toJSON())}, {status: 200});
    } catch (err: any) {
        console.error('/broadcast/lookup error', err);
        return NextResponse.json({error: err?.message || 'Internal Server Error'}, {status: 500});
    }
}
