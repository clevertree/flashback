import 'reflect-metadata';
import {NextRequest, NextResponse} from 'next/server';
import {initDatabase, UserModel} from '@/db/models';
import {parseCertWithNodeCrypto} from "@db/keyUtils";

export const runtime = 'nodejs';

export interface RegisterRequestBody {
    certificate: string;
}

/**
 * Registers a user public key pair to be used for identifying users, media, and broadcast servers..
 */
export async function POST(req: NextRequest) {
    try {
        await initDatabase();

        const body = (await req.json().catch(() => null)) as RegisterRequestBody | null;
        if (!body) return NextResponse.json({error: 'Invalid JSON body'}, {status: 400});

        const {certificate} = body;

        if (!certificate) {
            return NextResponse.json({error: 'Missing required fields: public_key_full'}, {status: 400});
        }

        const {email, publicKeyHash} = parseCertWithNodeCrypto(certificate);
        if (!email)
            return NextResponse.json({error: "Invalid email attribute"}, {status: 400});
        if (!publicKeyHash)
            return NextResponse.json({error: "Invalid hash"}, {status: 400});

        const existing = await UserModel.findOne({
            where: {
                email,
                publicKeyHash
            }
        });

        if (!existing) {
            const existingUser = await UserModel.findOne({
                where: {email}
            });

            if (existingUser) {
                // Email exists with a different key
                return NextResponse.json(
                    {error: 'User already exists with a different public key.'},
                    {status: 409}
                );
            }

            const created = await UserModel.create({
                certificate,
                publicKeyHash,
                email,
            });
            return NextResponse.json({
                id: created.id,
                publicKeyHash
            }, {status: 201});
        }

        // Existing user with the same email and key
        return NextResponse.json({error: "User exists with the same email and key"}, {status: 409});
    } catch (err: unknown) {
        if (err instanceof Error) {
            console.error('register error', err);
            return NextResponse.json({error: err?.message || 'Internal Server Error'}, {status: 500});
        }
        throw err;
    }
}
