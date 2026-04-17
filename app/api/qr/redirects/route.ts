import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';

// Get all QR redirect configurations
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const brandId = await getDefaultBrandId();

    // Get all tables
    const tables = await prisma.barTable.findMany({
      where: { brandId },
      orderBy: { tableNumber: 'asc' },
      select: {
        id: true,
        tableNumber: true,
        tableName: true,
        isActive: true,
        redirectUrl: true,
        scanCount: true,
        lastScannedAt: true,
        qrCodeUrl: true
      }
    });

    // If date filters are provided, calculate scan counts from history
    if (dateFrom || dateTo) {
      const fromDate = dateFrom ? new Date(dateFrom) : null;
      if (fromDate) fromDate.setHours(0, 0, 0, 0);
      
      const toDate = dateTo ? new Date(dateTo) : null;
      if (toDate) toDate.setHours(23, 59, 59, 999);

      // Get scan counts for each table in the date range
      const scanCounts = await prisma.qrScan.groupBy({
        by: ['tableId'],
        where: {
          ...(fromDate && toDate ? {
            scannedAt: {
              gte: fromDate,
              lte: toDate
            }
          } : fromDate ? {
            scannedAt: { gte: fromDate }
          } : toDate ? {
            scannedAt: { lte: toDate }
          } : {}),
        },
        _count: {
          id: true
        }
      });

      // Get last scanned date for each table in the date range
      const lastScans = await prisma.qrScan.findMany({
        where: {
          ...(fromDate && toDate ? {
            scannedAt: {
              gte: fromDate,
              lte: toDate
            }
          } : fromDate ? {
            scannedAt: { gte: fromDate }
          } : toDate ? {
            scannedAt: { lte: toDate }
          } : {}),
        },
        select: {
          tableId: true,
          scannedAt: true
        },
        orderBy: {
          scannedAt: 'desc'
        }
      });

      // Create maps for quick lookup
      const scanCountMap = new Map(scanCounts.map(s => [s.tableId, s._count.id]));
      const lastScanMap = new Map<string, Date>();
      lastScans.forEach(scan => {
        if (!lastScanMap.has(scan.tableId) || scan.scannedAt > lastScanMap.get(scan.tableId)!) {
          lastScanMap.set(scan.tableId, scan.scannedAt);
        }
      });

      // Update tables with filtered scan counts and last scanned dates
      const filteredTables = tables.map(table => {
        const periodScanCount = scanCountMap.get(table.id) || 0;
        const periodLastScanned = lastScanMap.get(table.id) || null;
        
        return {
          ...table,
          scanCount: periodScanCount,
          lastScannedAt: periodLastScanned
        };
      });

      return NextResponse.json({ tables: filteredTables });
    }

    return NextResponse.json({ tables });
  } catch (error) {
    console.error('Error fetching QR redirects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update QR redirect configuration
export async function PUT(request: Request) {
  try {
    const { tableNumber, redirectUrl, isActive, tableName } = await request.json();
    const brandId = await getDefaultBrandId();

    if (!tableNumber) {
      return NextResponse.json({ error: 'Table number required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (redirectUrl !== undefined) {
      updateData.redirectUrl = redirectUrl || null;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }
    if (tableName !== undefined) {
      const nextName = String(tableName || '').trim();
      // keep labels short so they don't break QR card/layouts
      updateData.tableName = nextName ? nextName.slice(0, 18) : null;
    }

    const table = await prisma.barTable.update({
      where: {
        brandId_tableNumber: { brandId, tableNumber: parseInt(String(tableNumber), 10) },
      },
      data: updateData,
    });

    return NextResponse.json({ 
      success: true, 
      table: {
        tableNumber: table.tableNumber,
        redirectUrl: table.redirectUrl,
        isActive: table.isActive,
        tableName: table.tableName
      }
    });
  } catch (error) {
    console.error('Error updating QR redirect:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

