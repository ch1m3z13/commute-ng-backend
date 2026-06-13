import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  pointToSegmentDistance,
  directionIsCompatible,
  computeMatchScore,
  matchScoreToPercentage,
} from '../../../services/geoUtils.js';

describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistance(9.0579, 7.4951, 9.0579, 7.4951)).toBe(0);
  });

  it('returns ~111km for 1 degree latitude difference', () => {
    const d = haversineDistance(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  it('returns correct distance for Abuja coordinates', () => {
    const d = haversineDistance(9.0579, 7.4951, 9.0650, 7.4914);
    expect(d).toBeGreaterThan(500);
    expect(d).toBeLessThan(2000);
  });

  it('is symmetric', () => {
    const a = haversineDistance(9.0579, 7.4951, 9.0650, 7.4914);
    const b = haversineDistance(9.0650, 7.4914, 9.0579, 7.4951);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('pointToSegmentDistance', () => {
  it('returns 0 when point is on the segment', () => {
    const d = pointToSegmentDistance(9.0600, 7.4930, 9.0579, 7.4951, 9.0650, 7.4914);
    expect(d).toBeLessThan(100);
  });

  it('returns distance to nearest endpoint when projection falls outside', () => {
    const d = pointToSegmentDistance(9.1000, 7.5000, 9.0579, 7.4951, 9.0650, 7.4914);
    expect(d).toBeGreaterThan(0);
  });

  it('handles degenerate case (start === end)', () => {
    const d = pointToSegmentDistance(9.1000, 7.5000, 9.0579, 7.4951, 9.0579, 7.4951);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeCloseTo(haversineDistance(9.1000, 7.5000, 9.0579, 7.4951), 0);
  });
});

describe('directionIsCompatible', () => {
  it('returns true when pickup is closer to driver start than dropoff', () => {
    const result = directionIsCompatible(
      9.058, 7.496,   // rider pickup (near start)
      9.064, 7.492,   // rider dropoff (farther from start)
      9.0579, 7.4951, // driver start
      9.0650, 7.4914, // driver end
    );
    expect(result).toBe(true);
  });

  it('returns false when dropoff is closer to driver start', () => {
    const result = directionIsCompatible(
      9.064, 7.492,   // rider pickup (farther from start)
      9.058, 7.496,   // rider dropoff (near start)
      9.0579, 7.4951, // driver start
      9.0650, 7.4914, // driver end
    );
    expect(result).toBe(false);
  });
});

describe('computeMatchScore', () => {
  it('returns 0 for zero detour and zero time delta', () => {
    expect(computeMatchScore(0, 0, 0)).toBe(0);
  });

  it('penalizes larger detours', () => {
    const low = computeMatchScore(100, 100, 0);
    const high = computeMatchScore(500, 500, 0);
    expect(high).toBeGreaterThan(low);
  });

  it('penalizes larger time differences', () => {
    const low = computeMatchScore(0, 0, 5);
    const high = computeMatchScore(0, 0, 30);
    expect(high).toBeGreaterThan(low);
  });
});

describe('matchScoreToPercentage', () => {
  it('returns 100 for score 0', () => {
    expect(matchScoreToPercentage(0)).toBe(100);
  });

  it('returns 0 for score >= 5000', () => {
    expect(matchScoreToPercentage(5000)).toBe(0);
    expect(matchScoreToPercentage(6000)).toBe(0);
  });

  it('returns 50 for score 2500', () => {
    expect(matchScoreToPercentage(2500)).toBe(50);
  });
});
