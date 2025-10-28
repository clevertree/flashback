import 'reflect-metadata';
import {NextRequest, NextResponse} from 'next/server';
import {Op} from 'sequelize';
import {BroadcastSourceModel, initDatabase, UserModel} from '@/db/models';

/**
 * GET /api/broadcast/lookup?publicKeyHash=...&minutes=10
 */
interface BroadcastLookupQuery {
    publicKeyHash: string;
    minutes?: number; // default 10, clamped 1..1440
}

export async function GET(req: NextRequest) {
    try {
        await initDatabase();
        const {searchParams} = new URL(req.url);
        const q: BroadcastLookupQuery = {
            publicKeyHash: searchParams.get('publicKeyHash') ?? '',
            minutes: (() => {
                const raw = searchParams.get('minutes');
                if (raw == null) return undefined;
                const n = Number.parseInt(raw, 10);
                return Number.isFinite(n) ? Math.max(1, Math.min(1440, n)) : undefined;
            })(),
        };

        if (!q.publicKeyHash) {
            return NextResponse.json({error: 'Missing publicKeyHash'}, {status: 400});
        }

        const minutes = q.minutes ?? 10;
        const since = new Date(Date.now() - minutes * 60 * 1000);

        const user = await UserModel.findOne({where: {publicKeyHash: q.publicKeyHash}});
        if (!user) {
            return NextResponse.json({items: []}, {status: 200});
        }

        const items = await BroadcastSourceModel.findAll({
            where: {
                user_id: user.id,
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
