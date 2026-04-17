import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';

export async function GET() {
  try {
    const brandId = await getDefaultBrandId();
    const tables = await prisma.barTable.findMany({
      where: { brandId },
      orderBy: { tableNumber: 'asc' }
    });

    // Format data for frontend
    const formattedTables = tables.map(table => ({
      tableNumber: table.tableNumber,
      tableName: table.tableName,
      qrCodeDataUrl: table.qrCodeData,
      qrCodeUrl: table.qrCodeUrl
    }));

    return NextResponse.json({ tables: formattedTables });
  } catch (error) {
    console.error('Get tables error:', error);
    return NextResponse.json({ error: 'Failed to get tables' }, { status: 500 });
  }
}

