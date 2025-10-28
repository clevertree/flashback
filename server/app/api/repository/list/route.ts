import 'reflect-metadata';
import { NextRequest, NextResponse } from 'next/server';
import { initDatabase, RepositoryModel } from '@/db/models';

export const runtime = 'nodejs';

// GET /api/repository/list
export async function GET(_req: NextRequest) {
  try {
    await initDatabase();

    // Seed default entry if empty
    const count = await RepositoryModel.count();
    if (count === 0) {
      try {
        await RepositoryModel.create({
          title: 'FlashBack Movies',
          url: 'https://github.com/clevertree/flashback-movies.git',
        });
      } catch {}
    }

    const repos = await RepositoryModel.findAll({ order: [['title', 'ASC']] });
    return NextResponse.json({ items: repos.map(r => r.toJSON()) }, { status: 200 });
  } catch (err: any) {
    console.error('/repository/list error', err);
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
