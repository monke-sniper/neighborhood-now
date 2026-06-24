import { promises as fs } from 'fs';
import path from 'path';
import { filterByRadius } from '../utils/geo';
import type { Complaint, LatLon } from '../types';

let cache: Complaint[] | null = null;

async function loadAll(): Promise<Complaint[]> {
  if (cache) return cache;
  const file = path.join(process.cwd(), 'data', 'toronto-311.json');
  const raw = await fs.readFile(file, 'utf-8');
  const parsed = JSON.parse(raw) as Complaint[];
  cache = Array.isArray(parsed) ? parsed : [];
  return cache;
}

export async function fetchComplaints(center: LatLon): Promise<Complaint[]> {
  try {
    const all = await loadAll();
    return filterByRadius(all, center, 1500);
  } catch {
    return [];
  }
}
