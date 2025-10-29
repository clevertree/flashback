import 'reflect-metadata';
import {NextRequest, NextResponse} from 'next/server';
import {BroadcastSourceModel, initDatabase, UserModel} from '@/db/models';

export const runtime = 'nodejs';

interface BroadcastReadyRequestBody {
    publicKeyHash: string;
    socket_address: string;
}

/**
 * Informs the server that a client is ready to receive broadcast requests.
 */
export async function POST(req: NextRequest) {
    try {
        await initDatabase();

        const body: BroadcastReadyRequestBody = await req.json().catch(() => null);
        if (!body) return NextResponse.json({error: 'Invalid JSON body'}, {status: 400});

        const {publicKeyHash, socket_address} = body || {};
        if (!publicKeyHash || !socket_address) {
            return NextResponse.json({error: 'Missing required fields: publicKeyHash, socket_address'}, {status: 400});
        }

        const user = await UserModel.findOne({where: {publicKeyHash}});
        if (!user) {
            return NextResponse.json({error: 'User not registered'}, {status: 400});
        }

        // Upsert by unique tuple (user_id, socket_address). If not unique in schema, emulate upsert.
        const existing = await BroadcastSourceModel.findOne({
            where: {
                user_id: user.id,
                socket_address
            }
        });
        if (existing) {
            existing.socket_address = socket_address;
            await existing.save();
            return NextResponse.json(existing.toJSON(), {status: 200});
        } else {
            const created = await BroadcastSourceModel.create({user_id: user.id, socket_address});
            return NextResponse.json(created.toJSON(), {status: 201});
        }

    } catch (err: unknown) {
        if (err instanceof Error) {
            console.error('/broadcast/ready error', err);
            return NextResponse.json({error: err?.message || 'Internal Server Error'}, {status: 500});
        }
        throw err;
    }
}
