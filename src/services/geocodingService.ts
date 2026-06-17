import { getDb } from '../config/database.js';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'CommuteNG/1.0 (https://commute.ng)';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  raw: Record<string, unknown>;
}

export interface CachedGeocode {
  lat: number;
  lng: number;
  displayName: string;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

export class GeocodingService {
  private rateLimitDelay = 1100; // Nominatim: 1 req/sec max
  private lastRequestTime = 0;

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitDelay) {
      await new Promise((r) => setTimeout(r, this.rateLimitDelay - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async getCache(query: string): Promise<CachedGeocode | null> {
    const normalized = normalizeQuery(query);
    const row = await getDb().prepare(
      'SELECT lat, lng, raw_json FROM geocache WHERE query = ?'
    ).get(normalized) as { lat: number; lng: number; raw_json?: string } | undefined;
    if (row) {
      const raw = row.raw_json ? JSON.parse(row.raw_json) as Record<string, unknown> : {};
      return { lat: row.lat, lng: row.lng, displayName: (raw.display_name as string) || '' };
    }
    return null;
  }

  private async setCache(query: string, result: GeocodeResult): Promise<void> {
    const normalized = normalizeQuery(query);
    await getDb().prepare(
      'INSERT INTO geocache (query, lat, lng, raw_json, createdAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT (query) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, raw_json = EXCLUDED.raw_json, createdAt = EXCLUDED.createdAt'
    ).run(normalized, result.lat, result.lng, JSON.stringify(result.raw), new Date().toISOString());
  }

  async searchLocalLocations(query: string): Promise<GeocodeResult[]> {
    const normalized = query.trim().toLowerCase();
    const rows = await getDb().prepare(
      'SELECT displayName, lat, lng, category FROM locations WHERE displayName ILIKE ? LIMIT 5'
    ).all([`%${normalized}%`]);

    return rows.map(row => ({
      lat: Number(row.lat),
      lng: Number(row.lng),
      displayName: String(row.displayName),
      raw: { category: String(row.category) },
    }));
  }

  async geocode(query: string): Promise<GeocodeResult> {
    // 1. Check local seed locations first (instant)
    const localResults = await this.searchLocalLocations(query);
    if (localResults.length > 0) {
      // Return the first best match from the seed
      return { ...localResults[0], raw: {} };
    }

    // 2. Fallback to reactive cache
    const cached = await this.getCache(query);
    if (cached) {
      return {
        lat: cached.lat,
        lng: cached.lng,
        displayName: cached.displayName,
        raw: {},
      };
    }

    // Throttle to respect Nominatim rate limits
    await this.throttle();

    // Search with Abuja bias for better results
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'ng',
      'accept-language': 'en',
      viewbox: '6.8,3.0,7.6,9.4', // Abuja bounding box (rough)
      bounded: '0',
    });

    const url = `${NOMINATIM_BASE}/search?${params.toString()}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed: HTTP ${response.status}`);
    }

    const data = await response.json() as Array<{ lat: string; lon: string; display_name: string; [key: string]: unknown }>;

    if (!data || data.length === 0) {
      throw new Error(`Address not found: "${query}". Please be more specific.`);
    }

    const result: GeocodeResult = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
      raw: data[0],
    };

    await this.setCache(query, result);
    return result;
  }

  async autocomplete(query: string): Promise<GeocodeResult[]> {
    // 1. Search local high-value locations first (instant)
    const localResults = await this.searchLocalLocations(query);
    if (localResults.length >= 5) {
      return localResults;
    }

    // 2. If not enough local matches, fetch from Nominatim (throttled)
    await this.throttle();

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      countrycodes: 'ng',
      'accept-language': 'en',
      viewbox: '6.8,3.0,7.6,9.4',
      bounded: '0',
    });

    const url = `${NOMINATIM_BASE}/search?${params.toString()}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`Autocomplete failed: HTTP ${response.status}`);
    }

    const data = await response.json() as Array<{ lat: string; lon: string; display_name: string; [key: string]: unknown }>;

    const remoteResults = (data || []).map(item => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      displayName: item.display_name,
      raw: item,
    }));

    // Merge local results with remote results, avoiding duplicates
    const combined = [...localResults];
    for (const remote of remoteResults) {
      if (!combined.some(local => local.displayName === remote.displayName)) {
        combined.push(remote);
      }
    }

    return combined.slice(0, 5);
  }
}

export const geocodingService = new GeocodingService();
