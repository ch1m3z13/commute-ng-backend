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
      'SELECT lat, lng, displayName FROM geocache WHERE query = ?'
    ).get(normalized) as { lat: number; lng: number; displayName: string } | undefined;
    if (row) {
      return { lat: row.lat, lng: row.lng, displayName: row.displayName };
    }
    return null;
  }

  private async setCache(query: string, result: GeocodeResult): Promise<void> {
    const normalized = normalizeQuery(query);
    await getDb().prepare(
      'INSERT INTO geocache (query, lat, lng, raw_json, createdAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT (query) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, raw_json = EXCLUDED.raw_json, createdAt = EXCLUDED.createdAt'
    ).run(normalized, result.lat, result.lng, JSON.stringify(result.raw), new Date().toISOString());
  }

  async geocode(query: string): Promise<GeocodeResult> {
    // Check cache first
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

  async geocodeStrict(query: string): Promise<GeocodeResult> {
    await this.throttle();

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      countrycodes: 'ng',
      'accept-language': 'en',
      viewbox: '6.8,3.0,7.6,9.4',
      bounded: '1',
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
      throw new Error(`Address not found within Abuja: "${query}". Please provide a more specific address.`);
    }

    const result: GeocodeResult = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
      raw: data[0],
    };

    this.setCache(query, result);
    return result;
  }
}

export const geocodingService = new GeocodingService();
