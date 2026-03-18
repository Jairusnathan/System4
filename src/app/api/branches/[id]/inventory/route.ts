import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: branchId } = await params;
    const inventory = db.prepare('SELECT * FROM branch_inventory WHERE branch_id = ?').all(branchId);
    return NextResponse.json(inventory);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
