/**
 * Unified Partners Data Access Layer
 * @license Apache-2.0
 */

import { Partner } from '../../types';
import { db } from '../db';
import { IDataProvider } from './types';

export async function getAllPartners(): Promise<Partner[]> {
  try {
    return db.getPartners();
  } catch (err) {
    console.warn('[DataLayer] Failed reading partners:', err);
    return [];
  }
}

export async function getPartnerById(id: string): Promise<Partner | null> {
  const list = await getAllPartners();
  return list.find(p => p.id === id) || null;
}

export async function createPartner(data: Partial<Partner>): Promise<Partner> {
  const list = db.getPartners();
  const newPartner: Partner = {
    id: data.id || `PARTNER-${Date.now()}`,
    name: data.name || '',
    nameAr: data.nameAr || data.name || '',
    sharePercentage: data.sharePercentage || 0,
    isSystemOwner: data.isSystemOwner ?? false,
    balance: data.balance || 0,
    ...data
  } as Partner;
  list.push(newPartner);
  db.savePartners(list);
  return newPartner;
}

export async function updatePartner(id: string, data: Partial<Partner>): Promise<Partner> {
  const existing = await getPartnerById(id);
  const updated = { ...(existing || {}), ...data, id } as Partner;
  db.updatePartner(updated);
  return updated;
}

export async function deletePartner(id: string): Promise<boolean> {
  try {
    const list = db.getPartners().filter(p => p.id !== id);
    db.savePartners(list);
    return true;
  } catch (e) {
    console.error('[DataLayer] Delete partner error:', e);
    return false;
  }
}

export const partnersDataProvider: IDataProvider<Partner> = {
  get: getPartnerById,
  list: async () => getAllPartners(),
  insert: createPartner,
  update: updatePartner,
  remove: deletePartner,
};
