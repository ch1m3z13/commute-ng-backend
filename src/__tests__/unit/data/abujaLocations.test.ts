import { describe, it, expect } from 'vitest';
import { LOCATIONS } from '../../../data/abujaLocations.js';

describe('Abuja seed locations', () => {
  it('has at least 50 locations', () => {
    expect(LOCATIONS.length).toBeGreaterThanOrEqual(50);
  });

  it('every location has required fields', () => {
    for (const loc of LOCATIONS) {
      expect(loc.name).toBeTruthy();
      expect(typeof loc.name).toBe('string');
      expect(typeof loc.lat).toBe('number');
      expect(typeof loc.lng).toBe('number');
      expect(typeof loc.cat).toBe('string');
    }
  });

  it('uses only valid categories', () => {
    const validCats = new Set(['suburb', 'junction', 'cbd_landmark', 'road']);
    for (const loc of LOCATIONS) {
      expect(validCats.has(loc.cat)).toBe(true);
    }
  });

  it('has no duplicate names', () => {
    const names = LOCATIONS.map(l => l.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('coordinates are within Abuja FCT bounding box (lat 8.5–9.5, lng 6.8–7.8)', () => {
    for (const loc of LOCATIONS) {
      expect(loc.lat).toBeGreaterThan(8.5);
      expect(loc.lat).toBeLessThan(9.5);
      expect(loc.lng).toBeGreaterThan(6.8);
      expect(loc.lng).toBeLessThan(7.8);
    }
  });

  it('has at least 5 suburbs', () => {
    const suburbs = LOCATIONS.filter(l => l.cat === 'suburb');
    expect(suburbs.length).toBeGreaterThanOrEqual(5);
  });

  it('has at least 10 junctions', () => {
    const junctions = LOCATIONS.filter(l => l.cat === 'junction');
    expect(junctions.length).toBeGreaterThanOrEqual(10);
  });

  it('has at least 5 CBD landmarks', () => {
    const landmarks = LOCATIONS.filter(l => l.cat === 'cbd_landmark');
    expect(landmarks.length).toBeGreaterThanOrEqual(5);
  });

  it('has Federal Secretariat as a CBD landmark', () => {
    const fedSec = LOCATIONS.find(l => l.name.includes('Federal Secretariat'));
    expect(fedSec).toBeDefined();
    expect(fedSec!.cat).toBe('cbd_landmark');
  });

  it('has key suburban corridors: Bwari, Dutse, Kubwa, Lugbe, Nyanya', () => {
    const corridors = ['Bwari', 'Dutse', 'Kubwa', 'Lugbe', 'Nyanya'];
    for (const c of corridors) {
      const found = LOCATIONS.some(l => l.name.includes(c));
      expect(found).toBe(true);
    }
  });

  it('has junction entries for each major suburb corridor', () => {
    const junctions = LOCATIONS.filter(l => l.cat === 'junction');
    const corridors = ['Dutse', 'Bwari', 'Kubwa', 'Lugbe', 'Nyanya', 'Zuba', 'Kado', 'Wuse', 'Garki'];
    for (const c of corridors) {
      const found = junctions.some(j => j.name.includes(c));
      expect(found).toBe(true);
    }
  });
});
