import { prisma } from './prisma';
import { getDefaultBrandId } from './brand';

export interface LocationSettings {
  id: string;
  addressBg: string;
  addressEn: string;
  addressRo: string;
  phone: string;
  instagramUrl: string;
  facebookUrl: string;
}

const DEFAULT_ADDRESS = {
  addressBg: 'Русе, ул. Александровска 97',
  addressEn: 'Ruse, 97 Alexandrovska St',
  addressRo: 'Ruse, str. Alexandrovska 97',
  phone: '089 853 6542',
  instagramUrl: '',
  facebookUrl: '',
};

export async function getLocationSettings(): Promise<LocationSettings> {
  try {
    const brandId = await getDefaultBrandId();
    const settings = await prisma.locationSettings.findUnique({
      where: { brandId },
    });

    if (settings) {
      return {
        id: settings.id,
        addressBg: settings.addressBg || DEFAULT_ADDRESS.addressBg,
        addressEn: settings.addressEn || DEFAULT_ADDRESS.addressEn,
        addressRo: settings.addressRo || DEFAULT_ADDRESS.addressRo,
        phone: (settings as any).phone || DEFAULT_ADDRESS.phone,
        instagramUrl: (settings as any).instagramUrl || DEFAULT_ADDRESS.instagramUrl,
        facebookUrl: (settings as any).facebookUrl || DEFAULT_ADDRESS.facebookUrl,
      };
    }

    const newSettings = await prisma.locationSettings.create({
      data: {
        brandId,
        ...DEFAULT_ADDRESS,
      },
    });

    return {
      id: newSettings.id,
      addressBg: newSettings.addressBg,
      addressEn: newSettings.addressEn,
      addressRo: newSettings.addressRo,
      phone: (newSettings as any).phone || DEFAULT_ADDRESS.phone,
      instagramUrl: (newSettings as any).instagramUrl || DEFAULT_ADDRESS.instagramUrl,
      facebookUrl: (newSettings as any).facebookUrl || DEFAULT_ADDRESS.facebookUrl,
    };
  } catch (error) {
    console.error('Error fetching location settings:', error);
    return {
      id: '',
      ...DEFAULT_ADDRESS,
    };
  }
}

export async function updateLocationSettings(data: {
  addressBg: string;
  addressEn: string;
  addressRo: string;
  phone?: string;
  instagramUrl?: string;
  facebookUrl?: string;
}): Promise<LocationSettings> {
  try {
    const brandId = await getDefaultBrandId();
    const existing = await prisma.locationSettings.findUnique({
      where: { brandId },
    });

    if (existing) {
      const updated = await prisma.locationSettings.update({
        where: { id: existing.id },
        data: {
          addressBg: data.addressBg,
          addressEn: data.addressEn,
          addressRo: data.addressRo,
          phone: data.phone ?? (existing as any).phone ?? DEFAULT_ADDRESS.phone,
          instagramUrl: data.instagramUrl ?? (existing as any).instagramUrl ?? DEFAULT_ADDRESS.instagramUrl,
          facebookUrl: data.facebookUrl ?? (existing as any).facebookUrl ?? DEFAULT_ADDRESS.facebookUrl,
        },
      });

      return {
        id: updated.id,
        addressBg: updated.addressBg,
        addressEn: updated.addressEn,
        addressRo: updated.addressRo,
        phone: (updated as any).phone || DEFAULT_ADDRESS.phone,
        instagramUrl: (updated as any).instagramUrl || DEFAULT_ADDRESS.instagramUrl,
        facebookUrl: (updated as any).facebookUrl || DEFAULT_ADDRESS.facebookUrl,
      };
    }

    const created = await prisma.locationSettings.create({
      data: {
        brandId,
        addressBg: data.addressBg,
        addressEn: data.addressEn,
        addressRo: data.addressRo,
        phone: data.phone ?? DEFAULT_ADDRESS.phone,
        instagramUrl: data.instagramUrl ?? DEFAULT_ADDRESS.instagramUrl,
        facebookUrl: data.facebookUrl ?? DEFAULT_ADDRESS.facebookUrl,
      },
    });

    return {
      id: created.id,
      addressBg: created.addressBg,
      addressEn: created.addressEn,
      addressRo: created.addressRo,
      phone: (created as any).phone || DEFAULT_ADDRESS.phone,
      instagramUrl: (created as any).instagramUrl || DEFAULT_ADDRESS.instagramUrl,
      facebookUrl: (created as any).facebookUrl || DEFAULT_ADDRESS.facebookUrl,
    };
  } catch (error) {
    console.error('Error updating location settings:', error);
    throw error;
  }
}
