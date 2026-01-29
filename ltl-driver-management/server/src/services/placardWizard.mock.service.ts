/**
 * Placard Wizard Mock Service
 *
 * This service simulates an external placard determination API (Placard Wizard).
 * It determines required placards based on hazmat cargo following DOT regulations.
 * In production, this would be replaced with actual API calls.
 */

export interface HazmatItem {
  proNumber: string;
  unNumber: string;
  hazardClass: string;
  packingGroup?: string;
  shippingName: string;
  weight: number;
  isBulk: boolean;
  isLimitedQty: boolean;
}

export interface PlacardResult {
  placardClass: string;
  placardLabel: string;
}

export interface PlacardDetermination {
  requiresPlacarding: boolean;
  placards: PlacardResult[];
  warnings: string[];
  guidelineText: string;
  bulkPackagingText: string;
}

// Placard class information
const placardInfo: Record<string, { label: string; color: string }> = {
  '1': { label: 'EXPLOSIVES', color: 'orange' },
  '1.1': { label: 'EXPLOSIVES 1.1', color: 'orange' },
  '1.2': { label: 'EXPLOSIVES 1.2', color: 'orange' },
  '1.3': { label: 'EXPLOSIVES 1.3', color: 'orange' },
  '1.4': { label: 'EXPLOSIVES 1.4', color: 'orange' },
  '1.5': { label: 'EXPLOSIVES 1.5', color: 'orange' },
  '1.6': { label: 'EXPLOSIVES 1.6', color: 'orange' },
  '2.1': { label: 'FLAMMABLE GAS', color: 'red' },
  '2.2': { label: 'NON-FLAMMABLE GAS', color: 'green' },
  '2.3': { label: 'POISON GAS', color: 'white' },
  '3': { label: 'FLAMMABLE', color: 'red' },
  '4.1': { label: 'FLAMMABLE SOLID', color: 'red-white-stripes' },
  '4.2': { label: 'SPONTANEOUSLY COMBUSTIBLE', color: 'red-white' },
  '4.3': { label: 'DANGEROUS WHEN WET', color: 'blue' },
  '5.1': { label: 'OXIDIZER', color: 'yellow' },
  '5.2': { label: 'ORGANIC PEROXIDE', color: 'red-yellow' },
  '6.1': { label: 'POISON', color: 'white' },
  '6.2': { label: 'INFECTIOUS SUBSTANCE', color: 'white' },
  '7': { label: 'RADIOACTIVE', color: 'yellow-white' },
  '8': { label: 'CORROSIVE', color: 'white-black' },
  '9': { label: 'MISCELLANEOUS', color: 'white-black-stripes' },
};

// Placard thresholds (in lbs) - simplified DOT rules
const PLACARD_THRESHOLD_DEFAULT = 1001; // lbs
const PLACARD_THRESHOLD_TABLE_1 = 0; // Any amount (explosives, poison gas, etc.)

// Classes that require placarding at any quantity (Table 1 materials)
const tableOneMaterials = ['1', '1.1', '1.2', '1.3', '2.3', '6.1', '7'];

// Generate SVG for placards
const generatePlacardSVG = (hazardClass: string): string => {
  const info = placardInfo[hazardClass] || placardInfo[hazardClass.split('.')[0]] || { label: 'DANGER', color: 'red' };
  const classNumber = hazardClass.includes('.') ? hazardClass : hazardClass;

  // Colors based on hazard class
  let backgroundColor = '#ffffff';
  let textColor = '#000000';

  switch (hazardClass) {
    case '8':
      textColor = '#000000';
      break;
    case '3':
    case '2.1':
    case '4.1':
      backgroundColor = '#ff0000';
      textColor = '#ffffff';
      break;
    case '2.2':
      backgroundColor = '#00aa00';
      textColor = '#ffffff';
      break;
    case '4.3':
      backgroundColor = '#0000ff';
      textColor = '#ffffff';
      break;
    case '5.1':
      backgroundColor = '#ffff00';
      textColor = '#000000';
      break;
    case '9':
      // Class 9 uses default white background
      break;
    default:
      backgroundColor = '#ffffff';
  }

  // Corrosive (Class 8) specific SVG
  if (hazardClass === '8') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="120" height="120">
      <defs>
        <clipPath id="diamond">
          <polygon points="50,2 98,50 50,98 2,50"/>
        </clipPath>
      </defs>
      <polygon points="50,2 98,50 50,98 2,50" fill="#ffffff" stroke="#000000" stroke-width="2"/>
      <rect x="2" y="50" width="96" height="48" fill="#000000" clip-path="url(#diamond)"/>
      <!-- Test tubes with liquid dropping -->
      <g transform="translate(25, 18)">
        <!-- Hand being corroded -->
        <path d="M15,0 L20,0 L20,12 C22,14 25,18 25,22 C25,28 20,30 15,30 C10,30 5,28 5,22 C5,18 8,14 10,12 L10,0 Z"
              fill="none" stroke="#000000" stroke-width="1.5"/>
        <!-- Drops -->
        <circle cx="15" cy="35" r="2" fill="#000000"/>
        <!-- Surface being corroded -->
        <rect x="5" y="40" width="20" height="3" fill="none" stroke="#000000" stroke-width="1"/>
      </g>
      <g transform="translate(50, 18)">
        <!-- Test tube -->
        <path d="M10,0 L15,0 L15,12 C17,14 20,18 20,22 C20,28 15,30 12,30 C9,30 5,28 5,22 C5,18 8,14 10,12 L10,0 Z"
              fill="none" stroke="#000000" stroke-width="1.5"/>
        <!-- Drops -->
        <circle cx="12" cy="35" r="2" fill="#000000"/>
        <!-- Surface being corroded -->
        <rect x="2" y="40" width="20" height="3" fill="none" stroke="#000000" stroke-width="1"/>
      </g>
      <text x="50" y="85" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#ffffff">8</text>
    </svg>`;
  }

  // Flammable (Class 3) specific SVG
  if (hazardClass === '3' || hazardClass === '2.1') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="120" height="120">
      <polygon points="50,2 98,50 50,98 2,50" fill="#ff0000" stroke="#000000" stroke-width="2"/>
      <!-- Flame icon -->
      <path d="M50,20 C55,30 65,35 65,50 C65,65 55,75 50,75 C45,75 35,65 35,50 C35,35 45,30 50,20 Z
               M50,40 C47,45 45,50 45,55 C45,62 47,65 50,65 C53,65 55,62 55,55 C55,50 53,45 50,40 Z"
            fill="#ffffff"/>
      <text x="50" y="88" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#ffffff">${classNumber}</text>
    </svg>`;
  }

  // Default placard SVG
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="120" height="120">
    <polygon points="50,2 98,50 50,98 2,50" fill="${backgroundColor}" stroke="#000000" stroke-width="2"/>
    <text x="50" y="45" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="${textColor}">${info.label}</text>
    <text x="50" y="75" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${textColor}">${classNumber}</text>
  </svg>`;
};

/**
 * Placard Wizard Mock Service
 */
export const placardWizardMockService = {
  /**
   * Determine required placards based on hazmat cargo
   */
  determinePlacards: async (hazmatItems: HazmatItem[]): Promise<PlacardDetermination> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50));

    if (hazmatItems.length === 0) {
      return {
        requiresPlacarding: false,
        placards: [],
        warnings: [],
        guidelineText: 'No hazardous materials on this shipment.',
        bulkPackagingText: '',
      };
    }

    // Group by hazard class and calculate total weights
    const classTotals: Record<string, number> = {};
    const classItems: Record<string, HazmatItem[]> = {};

    for (const item of hazmatItems) {
      const baseClass = item.hazardClass.split('.')[0];
      classTotals[item.hazardClass] = (classTotals[item.hazardClass] || 0) + item.weight;
      classTotals[baseClass] = (classTotals[baseClass] || 0) + item.weight;

      if (!classItems[item.hazardClass]) {
        classItems[item.hazardClass] = [];
      }
      classItems[item.hazardClass].push(item);
    }

    const requiredPlacards: PlacardResult[] = [];
    const warnings: string[] = [];

    // Determine required placards
    for (const [hazardClass, totalWeight] of Object.entries(classTotals)) {
      // Skip base class if we already have specific subclass
      if (!hazardClass.includes('.') && Object.keys(classTotals).some(k => k.startsWith(hazardClass + '.'))) {
        continue;
      }

      const isTableOne = tableOneMaterials.some(t => hazardClass.startsWith(t));
      const threshold = isTableOne ? PLACARD_THRESHOLD_TABLE_1 : PLACARD_THRESHOLD_DEFAULT;

      // Check for limited quantity exemptions
      const items = classItems[hazardClass] || [];
      const allLimitedQty = items.every(i => i.isLimitedQty);

      if (allLimitedQty && !isTableOne) {
        continue; // Limited quantity exemption applies
      }

      if (totalWeight > threshold || isTableOne) {
        const info = placardInfo[hazardClass] || placardInfo[hazardClass.split('.')[0]];
        if (info && !requiredPlacards.some(p => p.placardClass === hazardClass)) {
          requiredPlacards.push({
            placardClass: hazardClass,
            placardLabel: info.label,
          });
        }
      }
    }

    // Check for bulk packaging
    const hasBulk = hazmatItems.some(i => i.isBulk);
    if (hasBulk) {
      warnings.push('Bulk packaging detected. UN# must be displayed on placard.');
    }

    // Generate guideline text
    const guidelineText = `This sheet is a guideline for determining the required placards for a trailer at the time of dispatch. It cannot be used for shipping papers or other compliance paperwork. Verify the information listed below with the original BOLs before accepting the placard suggestions.`;

    const bulkPackagingText = `Check whether bulk packaging rules apply, and if so display the UN# on the placard. Bulk packaging applies to:
- Liquids in 119 gallons container or greater
- Solids in 882 lbs container or greater
- Gasses in a water capacity container of 1,000 lbs or greater`;

    return {
      requiresPlacarding: requiredPlacards.length > 0,
      placards: requiredPlacards,
      warnings,
      guidelineText,
      bulkPackagingText,
    };
  },

  /**
   * Get SVG image for a placard
   */
  getPlacardSVG: (placardClass: string): string => {
    return generatePlacardSVG(placardClass);
  },

  /**
   * Get placard label for a hazard class
   */
  getPlacardLabel: (hazardClass: string): string => {
    const info = placardInfo[hazardClass] || placardInfo[hazardClass.split('.')[0]];
    return info?.label || 'DANGER';
  },

  /**
   * Validate hazmat compatibility (simplified)
   */
  validateCompatibility: async (hazmatItems: HazmatItem[]): Promise<{
    compatible: boolean;
    issues: string[];
  }> => {
    const issues: string[] = [];

    // Check for incompatible classes (simplified rules)
    const classes = new Set(hazmatItems.map(i => i.hazardClass.split('.')[0]));

    // Oxidizers (5.1) + Flammables (3) = incompatible
    if (classes.has('5') && classes.has('3')) {
      issues.push('Warning: Oxidizers and flammable liquids may be incompatible.');
    }

    // Corrosives (8) + certain other materials
    if (classes.has('8') && classes.has('5')) {
      issues.push('Warning: Corrosives and oxidizers should be segregated.');
    }

    return {
      compatible: issues.length === 0,
      issues,
    };
  },
};
