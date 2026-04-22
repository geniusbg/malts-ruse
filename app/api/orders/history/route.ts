import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';

export async function GET(request: Request) {
  try {
    const brandId = await getDefaultBrandId();
    const { searchParams } = new URL(request.url);
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    
    // Filters
    const status = searchParams.get('status'); // pending, preparing, ready, completed, cancelled
    const tableNumber = searchParams.get('tableNumber');
    const tableNumbersRaw = searchParams.get('tableNumbers');
    const dateFrom = searchParams.get('dateFrom'); // YYYY-MM-DD
    const dateTo = searchParams.get('dateTo'); // YYYY-MM-DD
    const sortBy = searchParams.get('sortBy') || 'createdAt'; // createdAt, totalBgn, tableNumber
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // asc, desc

    const where: Prisma.OrderWhereInput = { brandId };
    
    if (status) {
      where.status = status;
    }
    
    const tableNumbers = (tableNumbersRaw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isFinite(n));

    if (tableNumbers.length > 0) {
      where.tableNumber = { in: tableNumbers };
    } else if (tableNumber) {
      where.tableNumber = parseInt(tableNumber);
    }
    
    // Date range filter - use server timezone (where DB is)
    if (dateFrom || dateTo) {
      where.createdAt = {};
      
      if (dateFrom) {
        // Create date at midnight in SERVER timezone (Bulgaria)
        const fromDate = new Date(dateFrom + 'T00:00:00');
        where.createdAt.gte = fromDate;
      }
      
      if (dateTo) {
        // Create date at end of day in SERVER timezone
        const toDate = new Date(dateTo + 'T23:59:59.999');
        where.createdAt.lte = toDate;
      }
    }

    // Get total count
    const totalCount = await prisma.order.count({ where });

    // Get orders with pagination
    const orders = await prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                nameBg: true,
                imageUrl: true,
                categoryId: true
              }
            }
          }
        }
      }
    });

    // Calculate revenue for current filters
    const revenueStats = await prisma.order.aggregate({
      where,
      _sum: {
        totalBgn: true,
        totalEur: true
      },
      _count: true
    });

    return NextResponse.json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      },
      revenue: {
        totalBgn: revenueStats._sum.totalBgn || 0,
        totalEur: revenueStats._sum.totalEur || 0,
        ordersCount: revenueStats._count
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error('Get orders history error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch orders history',
      details: error.message 
    }, { status: 500 });
  }
}

