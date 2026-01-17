/**
 * Placard Information Sheet HTML Template
 *
 * Generates a placard information document with hazmat details and required placards.
 */

import { format } from 'date-fns';

export interface PlacardHazmatItem {
  proNumber: string;
  unNumber: string;
  hazardClass: string;
  packingGroup?: string;
  weight?: number;
  isBulk: boolean;
  isLimitedQty: boolean;
  shippingName: string;
}

export interface RequiredPlacard {
  placardClass: string;
  placardLabel: string;
  svg?: string;
}

export interface PlacardSheetData {
  tripDisplay: string;
  trailerNumber?: string;
  hazmatItems: PlacardHazmatItem[];
  requiredPlacards: RequiredPlacard[];
  guidelineText: string;
  bulkPackagingText: string;
  printedAt: Date;
}

const formatDate = (date: Date, formatStr: string): string => {
  return format(date, formatStr);
};

// Generate corrosive placard SVG
const generateCorrosivePlacardSVG = (): string => {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="150" height="150">
      <!-- Diamond shape -->
      <polygon points="50,2 98,50 50,98 2,50" fill="#ffffff" stroke="#000000" stroke-width="2"/>
      <!-- Black bottom half -->
      <defs>
        <clipPath id="diamond-clip">
          <polygon points="50,2 98,50 50,98 2,50"/>
        </clipPath>
      </defs>
      <rect x="2" y="50" width="96" height="48" fill="#000000" clip-path="url(#diamond-clip)"/>

      <!-- Corrosive imagery - test tubes with liquid drops -->
      <g transform="translate(22, 12)">
        <!-- Left test tube with hand being corroded -->
        <ellipse cx="12" cy="8" rx="8" ry="4" fill="none" stroke="#000" stroke-width="1.5"/>
        <line x1="4" y1="8" x2="4" y2="25" stroke="#000" stroke-width="1.5"/>
        <line x1="20" y1="8" x2="20" y2="25" stroke="#000" stroke-width="1.5"/>
        <ellipse cx="12" cy="25" rx="8" ry="3" fill="none" stroke="#000" stroke-width="1.5"/>
        <!-- Drop -->
        <path d="M12,30 L14,36 Q12,38 10,36 Z" fill="#000"/>
        <!-- Surface being corroded -->
        <path d="M4,42 Q8,38 12,42 Q16,38 20,42" fill="none" stroke="#000" stroke-width="1.5"/>
      </g>

      <g transform="translate(48, 12)">
        <!-- Right test tube -->
        <ellipse cx="12" cy="8" rx="8" ry="4" fill="none" stroke="#000" stroke-width="1.5"/>
        <line x1="4" y1="8" x2="4" y2="25" stroke="#000" stroke-width="1.5"/>
        <line x1="20" y1="8" x2="20" y2="25" stroke="#000" stroke-width="1.5"/>
        <ellipse cx="12" cy="25" rx="8" ry="3" fill="none" stroke="#000" stroke-width="1.5"/>
        <!-- Drop -->
        <path d="M12,30 L14,36 Q12,38 10,36 Z" fill="#000"/>
        <!-- Surface being corroded -->
        <path d="M4,42 Q8,38 12,42 Q16,38 20,42" fill="none" stroke="#000" stroke-width="1.5"/>
      </g>

      <!-- Class number -->
      <text x="50" y="85" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#ffffff">8</text>
    </svg>
  `;
};

// Generate flammable placard SVG
const generateFlammablePlacardSVG = (): string => {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="150" height="150">
      <polygon points="50,2 98,50 50,98 2,50" fill="#ff0000" stroke="#000000" stroke-width="2"/>
      <!-- Flame icon -->
      <path d="M50,15 C58,28 70,35 70,50 C70,68 58,80 50,80 C42,80 30,68 30,50 C30,35 42,28 50,15 Z" fill="#ffffff"/>
      <path d="M50,35 C46,42 42,48 42,55 C42,65 46,70 50,70 C54,70 58,65 58,55 C58,48 54,42 50,35 Z" fill="#ff0000"/>
      <text x="50" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#ffffff">3</text>
    </svg>
  `;
};

// Generate generic placard SVG
const generateGenericPlacardSVG = (classNum: string, label: string, bgColor: string, textColor: string): string => {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="150" height="150">
      <polygon points="50,2 98,50 50,98 2,50" fill="${bgColor}" stroke="#000000" stroke-width="2"/>
      <text x="50" y="45" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="${textColor}">${label}</text>
      <text x="50" y="75" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="${textColor}">${classNum}</text>
    </svg>
  `;
};

const getPlacardSVG = (placardClass: string): string => {
  switch (placardClass) {
    case '8':
      return generateCorrosivePlacardSVG();
    case '3':
    case '2.1':
      return generateFlammablePlacardSVG();
    case '5.1':
      return generateGenericPlacardSVG(placardClass, 'OXIDIZER', '#ffff00', '#000000');
    case '2.2':
      return generateGenericPlacardSVG(placardClass, 'NON-FLAMMABLE GAS', '#00aa00', '#ffffff');
    case '6.1':
      return generateGenericPlacardSVG(placardClass, 'POISON', '#ffffff', '#000000');
    case '9':
      return generateGenericPlacardSVG(placardClass, 'MISC.', '#ffffff', '#000000');
    default:
      return generateGenericPlacardSVG(placardClass, 'DANGER', '#ff6600', '#000000');
  }
};

const generateHazmatRow = (item: PlacardHazmatItem): string => {
  return `
    <tr>
      <td>${item.proNumber}</td>
      <td>${item.unNumber}</td>
      <td>${item.hazardClass}</td>
      <td>${item.packingGroup || ''}</td>
      <td class="numeric">${item.weight ? item.weight.toLocaleString() : ''}</td>
      <td class="center">${item.isBulk ? 'Y' : 'N'}</td>
      <td class="center">${item.isLimitedQty ? 'Y' : 'N'}</td>
      <td class="shipping-name">${item.shippingName}</td>
    </tr>
  `;
};

export const generatePlacardSheetHTML = (data: PlacardSheetData): string => {
  const hazmatRows = data.hazmatItems.map(item => generateHazmatRow(item)).join('');

  const placardImages = data.requiredPlacards.map(placard => `
    <div class="placard-item">
      <div class="placard-svg">
        ${placard.svg || getPlacardSVG(placard.placardClass)}
      </div>
      <div class="placard-label">${placard.placardLabel} (${placard.placardClass})</div>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Placard Information Sheet - ${data.tripDisplay}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.3;
      color: #000;
      background: #fff;
    }

    .page {
      width: 8.5in;
      min-height: 11in;
      padding: 0.4in;
      position: relative;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
    }

    .trip-id {
      font-size: 16px;
      font-weight: bold;
    }

    .document-title {
      font-size: 18px;
      font-weight: bold;
    }

    .guidelines-section {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
    }

    .guideline-box {
      flex: 1;
      padding: 10px;
      font-size: 10px;
      line-height: 1.4;
    }

    .guideline-box p {
      margin-bottom: 8px;
    }

    .bulk-rules {
      flex: 1;
      padding: 10px;
    }

    .bulk-rules-header {
      font-weight: bold;
      font-size: 10px;
      margin-bottom: 5px;
    }

    .bulk-rules ul {
      font-size: 9px;
      margin-left: 15px;
    }

    .bulk-rules li {
      margin-bottom: 3px;
    }

    .hazmat-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
    }

    .hazmat-table th,
    .hazmat-table td {
      border: 1px solid #000;
      padding: 5px 8px;
      text-align: left;
    }

    .hazmat-table th {
      background: #f0f0f0;
      font-weight: bold;
      font-size: 10px;
    }

    .hazmat-table td {
      font-size: 10px;
    }

    .hazmat-table .numeric {
      text-align: right;
    }

    .hazmat-table .center {
      text-align: center;
    }

    .hazmat-table .shipping-name {
      max-width: 250px;
    }

    .placards-section {
      margin-top: 30px;
    }

    .placards-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 30px;
      justify-content: flex-start;
    }

    .placard-item {
      text-align: center;
    }

    .placard-svg {
      margin-bottom: 8px;
    }

    .placard-svg svg {
      width: 150px;
      height: 150px;
    }

    .placard-label {
      font-size: 12px;
      font-weight: bold;
    }

    .page-footer {
      position: absolute;
      bottom: 0.4in;
      left: 0.4in;
      right: 0.4in;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      border-top: 1px solid #ccc;
      padding-top: 8px;
    }

    @media print {
      .page {
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="page-header">
      <div class="trip-id">${data.tripDisplay}</div>
      <div class="document-title">Placard Information Sheet</div>
    </div>

    <div class="guidelines-section">
      <div class="guideline-box">
        <p>${data.guidelineText}</p>
      </div>
      <div class="bulk-rules">
        <div class="bulk-rules-header">Check whether bulk packaging rules apply, and if so display the UN# on the placard. Bulk packaging applies to:</div>
        <ul>
          <li>Liquids in 119 gallons container or greater</li>
          <li>Solids in 882 lbs container or greater</li>
          <li>Gasses in a water capacity container of 1,000 lbs or greater</li>
        </ul>
      </div>
    </div>

    <table class="hazmat-table">
      <thead>
        <tr>
          <th>Pro Num</th>
          <th>UN Num</th>
          <th>Class</th>
          <th>PG</th>
          <th>Weight</th>
          <th>Bulk?</th>
          <th>Ltd Qty?</th>
          <th>Shipping Name</th>
        </tr>
      </thead>
      <tbody>
        ${hazmatRows}
      </tbody>
    </table>

    ${data.requiredPlacards.length > 0 ? `
    <div class="placards-section">
      <div class="placards-grid">
        ${placardImages}
      </div>
    </div>
    ` : ''}

    <div class="page-footer">
      <div>${formatDate(data.printedAt, 'M/d/yyyy h:mm a')} CST</div>
      <div>Page 1 of 1</div>
    </div>
  </div>
</body>
</html>
  `;
};
