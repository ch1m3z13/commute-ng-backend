/**
 * Abuja location seed data — hardcoded geocodes.
 * Shared between the seed script and tests.
 */

export interface SeedLocation {
  name: string;
  lat: number;
  lng: number;
  cat: 'suburb' | 'junction' | 'cbd_landmark' | 'road';
}

export const LOCATIONS: SeedLocation[] = [
  // ── Suburbs (many-to-one origins) ─────────────────────────────────────────
  { name: 'Bwari, Abuja', lat: 9.2667, lng: 7.6167, cat: 'suburb' },
  { name: 'Ushafa, Bwari, Abuja', lat: 9.3000, lng: 7.5833, cat: 'suburb' },
  { name: 'Dutse, Abuja', lat: 9.1333, lng: 7.5000, cat: 'suburb' },
  { name: 'Nanya, Abuja', lat: 9.1167, lng: 7.4667, cat: 'suburb' },
  { name: 'Kado, Abuja', lat: 9.0667, lng: 7.4833, cat: 'suburb' },
  { name: 'Kubwa, Abuja', lat: 9.2167, lng: 7.5333, cat: 'suburb' },
  { name: 'Suleja, Abuja', lat: 9.1833, lng: 7.1833, cat: 'suburb' },
  { name: 'Kuje, Abuja', lat: 8.8833, lng: 7.2333, cat: 'suburb' },
  { name: 'Lugbe, Abuja', lat: 8.9833, lng: 7.4833, cat: 'suburb' },
  { name: 'Nyanya, Abuja', lat: 9.0667, lng: 7.6000, cat: 'suburb' },
  { name: 'Karu, Abuja', lat: 9.0833, lng: 7.5667, cat: 'suburb' },
  { name: 'Gwagwalada, Abuja', lat: 8.9333, lng: 7.0833, cat: 'suburb' },
  { name: 'Zuba, Abuja', lat: 9.1000, lng: 7.4333, cat: 'suburb' },
  { name: 'Dei-Dei, Abuja', lat: 9.0833, lng: 7.4833, cat: 'suburb' },
  { name: 'Karmo, Abuja', lat: 9.0500, lng: 7.4833, cat: 'suburb' },
  { name: 'Idu, Abuja', lat: 9.0333, lng: 7.4500, cat: 'suburb' },
  { name: 'Gwarinpa, Abuja', lat: 9.0667, lng: 7.4333, cat: 'suburb' },
  { name: 'Life Camp, Abuja', lat: 9.0500, lng: 7.4167, cat: 'suburb' },
  { name: 'Jabi, Abuja', lat: 9.0333, lng: 7.4333, cat: 'suburb' },
  { name: 'Utako, Abuja', lat: 9.0500, lng: 7.4500, cat: 'suburb' },
  { name: 'Maitama, Abuja', lat: 9.0833, lng: 7.4833, cat: 'suburb' },
  { name: 'Wuse, Abuja', lat: 9.0667, lng: 7.4833, cat: 'suburb' },
  { name: 'Garki, Abuja', lat: 9.0500, lng: 7.4833, cat: 'suburb' },
  { name: 'Asokoro, Abuja', lat: 9.0333, lng: 7.5000, cat: 'suburb' },
  { name: 'Wuye, Abuja', lat: 9.0667, lng: 7.4667, cat: 'suburb' },
  { name: 'Mabushi, Abuja', lat: 9.0667, lng: 7.4500, cat: 'suburb' },
  { name: 'Katampe, Abuja', lat: 9.0833, lng: 7.4667, cat: 'suburb' },
  { name: 'Galadimawa, Abuja', lat: 9.0167, lng: 7.4833, cat: 'suburb' },
  { name: 'Lokogoma, Abuja', lat: 9.0000, lng: 7.4833, cat: 'suburb' },
  { name: 'Apo, Abuja', lat: 9.0167, lng: 7.5167, cat: 'suburb' },
  { name: 'Durumi, Abuja', lat: 9.0167, lng: 7.5000, cat: 'suburb' },
  { name: 'Kabusa, Abuja', lat: 9.0000, lng: 7.5000, cat: 'suburb' },
  { name: 'Jahi, Abuja', lat: 9.0833, lng: 7.4333, cat: 'suburb' },
  { name: 'Dakibiyu, Abuja', lat: 9.0167, lng: 7.4833, cat: 'suburb' },
  { name: 'Karsana, Abuja', lat: 9.0333, lng: 7.4667, cat: 'suburb' },
  { name: 'Madalla, Abuja', lat: 9.2167, lng: 7.1833, cat: 'suburb' },

  // ── Junctions (well-known pickup/dropoff points) ──────────────────────────
  // Dutse corridor
  { name: 'First Gate Junction, Dutse, Abuja', lat: 9.1380, lng: 7.5030, cat: 'junction' },
  { name: 'Second Gate Junction, Dutse, Abuja', lat: 9.1320, lng: 7.4980, cat: 'junction' },
  { name: 'Powerline Junction, Dutse, Abuja', lat: 9.1290, lng: 7.4950, cat: 'junction' },
  { name: 'Dutse Market Junction, Abuja', lat: 9.1340, lng: 7.5010, cat: 'junction' },

  // Bwari corridor
  { name: 'Bwari Junction, Abuja', lat: 9.2680, lng: 7.6150, cat: 'junction' },
  { name: 'Bwari Market Junction, Abuja', lat: 9.2700, lng: 7.6130, cat: 'junction' },

  // Kubwa corridor
  { name: 'Kubwa Junction, Abuja', lat: 9.2180, lng: 7.5320, cat: 'junction' },
  { name: 'Extension Junction, Kubwa, Abuja', lat: 9.2220, lng: 7.5360, cat: 'junction' },

  // Lugbe corridor
  { name: 'Lugbe Junction, Abuja', lat: 8.9850, lng: 7.4850, cat: 'junction' },
  { name: 'Lugbe Under Bridge, Abuja', lat: 8.9820, lng: 7.4820, cat: 'junction' },
  { name: 'FHA Junction, Lugbe, Abuja', lat: 8.9780, lng: 7.4800, cat: 'junction' },

  // Nyanya corridor
  { name: 'Nyanya Junction, Abuja', lat: 9.0680, lng: 7.5990, cat: 'junction' },
  { name: 'Nyanya Market Junction, Abuja', lat: 9.0700, lng: 7.6020, cat: 'junction' },
  { name: 'Karu Junction, Abuja', lat: 9.0850, lng: 7.5650, cat: 'junction' },

  // Zuba corridor
  { name: 'Zuba Junction, Abuja', lat: 9.1020, lng: 7.4350, cat: 'junction' },
  { name: 'Zuba Motor Park, Abuja', lat: 9.1030, lng: 7.4370, cat: 'junction' },

  // Kado corridor
  { name: 'Kado Junction, Abuja', lat: 9.0680, lng: 7.4850, cat: 'junction' },
  { name: 'Kado Estate Junction, Abuja', lat: 9.0700, lng: 7.4870, cat: 'junction' },

  // Wuse corridor
  { name: 'Wuse Junction, Abuja', lat: 9.0670, lng: 7.4840, cat: 'junction' },
  { name: 'Wuse Market Junction, Abuja', lat: 9.0650, lng: 7.4860, cat: 'junction' },
  { name: 'Gimbiya Junction, Abuja', lat: 9.0630, lng: 7.4880, cat: 'junction' },

  // Garki corridor
  { name: 'Garki Junction, Abuja', lat: 9.0520, lng: 7.4850, cat: 'junction' },
  { name: 'Area 1 Junction, Garki, Abuja', lat: 9.0540, lng: 7.4830, cat: 'junction' },
  { name: 'Area 11 Junction, Garki, Abuja', lat: 9.0560, lng: 7.4810, cat: 'junction' },

  // CBD area junctions
  { name: 'Maitama Junction, Abuja', lat: 9.0810, lng: 7.4870, cat: 'junction' },
  { name: 'Aso Drive Junction, Abuja', lat: 9.0610, lng: 7.4800, cat: 'junction' },

  // ── CBD landmarks (destinations) ──────────────────────────────────────────
  { name: 'Federal Secretariat, Abuja', lat: 9.0580, lng: 7.4890, cat: 'cbd_landmark' },
  { name: 'Central Business District, Abuja', lat: 9.0580, lng: 7.4890, cat: 'cbd_landmark' },
  { name: 'National Assembly, Abuja', lat: 9.0550, lng: 7.4900, cat: 'cbd_landmark' },
  { name: 'NAFDAC Headquarters, Abuja', lat: 9.0530, lng: 7.4780, cat: 'cbd_landmark' },
  { name: 'CBN Headquarters, Abuja', lat: 9.0600, lng: 7.4870, cat: 'cbd_landmark' },
  { name: 'NNPC Towers, Abuja', lat: 9.0610, lng: 7.4850, cat: 'cbd_landmark' },
  { name: 'EFCC Headquarters, Abuja', lat: 9.0570, lng: 7.4910, cat: 'cbd_landmark' },
  { name: 'ICPC Headquarters, Abuja', lat: 9.0560, lng: 7.4920, cat: 'cbd_landmark' },
  { name: 'Transcorp Hilton, Abuja', lat: 9.0620, lng: 7.4830, cat: 'cbd_landmark' },
  { name: 'Aso Rock Presidential Villa, Abuja', lat: 9.0720, lng: 7.4920, cat: 'cbd_landmark' },
  { name: 'National Mosque, Abuja', lat: 9.0570, lng: 7.4860, cat: 'cbd_landmark' },
  { name: 'National Christian Centre, Abuja', lat: 9.0560, lng: 7.4870, cat: 'cbd_landmark' },

  // ── Key roads ─────────────────────────────────────────────────────────────
  { name: 'Constitution Avenue, Abuja', lat: 9.0550, lng: 7.4850, cat: 'road' },
  { name: 'Aso Drive, Abuja', lat: 9.0600, lng: 7.4800, cat: 'road' },
  { name: 'Airport Road, Abuja', lat: 9.0050, lng: 7.4500, cat: 'road' },
];
