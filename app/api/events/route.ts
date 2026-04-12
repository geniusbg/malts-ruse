import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const brandId = await getDefaultBrandId();

    // Convert eventDate to proper ISO format if needed
    if (data.eventDate && typeof data.eventDate === 'string') {
      data.eventDate = new Date(data.eventDate).toISOString();
    }

    const event = await prisma.event.create({
      data: {
        ...data,
        brandId,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const publishedOnly = searchParams.get('published') === 'true';
    const brandId = await getDefaultBrandId();

    const events = await prisma.event.findMany({
      where: {
        brandId,
        ...(publishedOnly ? { isPublished: true } : {}),
      },
      orderBy: [{ isExternal: 'asc' }, { eventDate: 'asc' }],
    });

    return NextResponse.json({ events }, { status: 200 });
  } catch (error) {
    console.error('Get events error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


