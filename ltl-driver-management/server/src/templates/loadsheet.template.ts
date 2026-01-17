import { format } from 'date-fns';

interface LoadsheetData {
  loadsheet: {
    id: number;
    manifestNumber: string;
    trailerNumber: string;
    suggestedTrailerLength: number | null;
    pintleHookRequired: boolean;
    targetDispatchTime: string | null;
    linehaulName: string;
    preloadManifest: string | null;
    originTerminalCode: string | null;
    loadDate: Date;
    straps: number | null;
    closeTime: string | null;
    loadType: string;
    loadbars: number | null;
    loaderNumber: string | null;
    exceptions: string | null;
    capacity: string | null;
    blankets: number | null;
    loaderName: string | null;
    sealNumber: string | null;
    wallCondition: string;
    floorCondition: string;
    roofCondition: string;
    trailerConditionComment: string | null;
    hazmatPlacards: string | null;
    originTerminal: { code: string; name: string } | null;
    hazmatItems: Array<{
      itemNumber: number;
      proNumber: string | null;
      hazmatClass: string | null;
      weight: number | null;
    }>;
    dispatchEntries: Array<{
      rowNumber: number;
      dispatchTime: string | null;
      dispatchTerminal: string | null;
      nextTerminal: string | null;
      tractorNumber: string | null;
      driverNumber: string | null;
      driverName: string | null;
      supervisorNumber: string | null;
    }>;
    freightPlacements: Array<{
      rowNumber: number;
      loose: string | null;
      left: string | null;
      right: string | null;
    }>;
  };
  mainBarcode: string;
  manifestBarcode: string;
  qrCode: string;
  printedAt: Date;
}

// Parse hazmat placards from JSON string
const parseHazmatPlacards = (hazmatPlacards: string | null): string[] => {
  if (!hazmatPlacards) return [];
  try {
    return JSON.parse(hazmatPlacards);
  } catch {
    return [];
  }
};

// Generate dispatch entries rows HTML (up to 4 rows)
const generateDispatchRows = (entries: LoadsheetData['loadsheet']['dispatchEntries']): string => {
  const rows: string[] = [];
  for (let i = 0; i < 4; i++) {
    const entry = entries.find(e => e.rowNumber === i + 1);
    rows.push(`
      <tr>
        <td class="cell-small">${entry?.dispatchTime || ''}</td>
        <td class="cell">${entry?.dispatchTerminal || (i === 0 ? '' : '')}</td>
        <td class="cell">${entry?.nextTerminal || ''}</td>
        <td class="cell">${entry?.tractorNumber || ''}</td>
        <td class="cell">${entry?.driverNumber || ''}</td>
        <td class="cell">${entry?.driverName || ''}</td>
      </tr>
    `);
  }
  return rows.join('');
};

// Generate hazmat items rows HTML (HM1-HM10)
const generateHazmatRows = (items: LoadsheetData['loadsheet']['hazmatItems']): string => {
  const rows: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const item = items.find(h => h.itemNumber === i);
    rows.push(`
      <tr>
        <td class="hazmat-label">HM${i}</td>
        <td class="cell">${item?.proNumber || ''}</td>
        <td class="cell-small">${item?.hazmatClass || ''}</td>
        <td class="cell-small">${item?.weight || ''}</td>
      </tr>
    `);
  }
  return rows.join('');
};

// Generate freight placement rows (4 rows: 25%, 50%, 75%, 100%)
const generateFreightRows = (placements: LoadsheetData['loadsheet']['freightPlacements']): string => {
  const percentages = ['25%', '50%', '75%', '100%'];
  const rowMapping = [5, 10, 15, 20]; // Map to row numbers that represent each percentage
  const rows: string[] = [];

  for (let i = 0; i < 4; i++) {
    const placement = placements.find(p => p.rowNumber === rowMapping[i]);
    rows.push(`
      <tr>
        <td class="freight-cell freight-label">${percentages[i]}</td>
        <td class="freight-cell">${placement?.left || ''}</td>
        <td class="freight-cell">${placement?.right || ''}</td>
      </tr>
    `);
  }
  return rows.join('');
};

export const generateLoadsheetHTML = (data: LoadsheetData): string => {
  const { loadsheet, mainBarcode, manifestBarcode, qrCode, printedAt } = data;
  const placards = parseHazmatPlacards(loadsheet.hazmatPlacards);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Loadsheet - ${loadsheet.manifestNumber}</title>
  <style>
    @page {
      size: letter;
      margin: 0.25in;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      margin: 0;
      padding: 0;
      line-height: 1.2;
    }

    /* Page Title */
    .page-title {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #000;
    }

    .page-title img {
      height: 50px;
    }

    .page-title h1 {
      font-size: 24pt;
      font-weight: bold;
      margin: 0;
    }

    .container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      height: 100%;
    }

    .left-column, .right-column {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      width: 100%;
    }

    .left-column table, .right-column table {
      width: 100%;
      table-layout: fixed;
    }

    /* Header Section */
    .header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 8px;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .trailer-number {
      font-size: 24pt;
      font-weight: bold;
    }

    .header-field {
      display: flex;
      gap: 5px;
      align-items: baseline;
    }

    .header-field label {
      font-weight: bold;
      font-size: 8pt;
    }

    .header-field .value {
      border-bottom: 1px solid #000;
      min-width: 50px;
      padding: 0 4px;
    }

    .barcode-section {
      text-align: center;
    }

    .barcode-section img {
      max-width: 100%;
      height: 100px;
    }

    .barcode-text {
      font-size: 20pt;
      margin-top: 4px;
    }

    .header-right {
      text-align: right;
    }

    .manifest-number {
      font-size: 24pt;
      font-weight: bold;
    }

    .manifest-label {
      font-weight: bold;
      font-size: 10pt;
    }

    .linehaul-name {
      font-size: 18pt;
      font-weight: bold;
      margin: 4px 0;
    }

    .preload-box {
      border: 2px solid #000;
      padding: 4px 8px;
      display: inline-block;
      margin-top: 4px;
    }

    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
    }

    th, td {
      border: 1px solid #000;
      padding: 2px 4px;
      text-align: left;
      font-size: 8pt;
    }

    th {
      background-color: #e0e0e0;
      font-weight: bold;
    }

    .cell {
      min-height: 18px;
    }

    .cell-small {
      width: 40px;
      min-height: 18px;
    }

    /* Loading Info Section */
    .loading-info {
      border: 1px solid #000;
    }

    .loading-info td {
      padding: 2px 4px;
    }

    .loading-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
    }

    /* HAZMAT Section */
    .hazmat-section {
      border: 2px solid #000;
      padding: 4px;
    }

    .hazmat-title {
      font-weight: bold;
      font-size: 11pt;
      text-align: center;
      margin-bottom: 4px;
    }

    .placards {
      margin-bottom: 8px;
    }

    .placards-title {
      font-weight: bold;
      font-size: 9pt;
    }

    .placard-row {
      display: flex;
      gap: 15px;
      margin: 4px 0;
    }

    .placard-item {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 8pt;
    }

    .checkbox {
      width: 12px;
      height: 12px;
      border: 1px solid #000;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10pt;
    }

    .checkbox.checked::after {
      content: '\\2713';
    }

    .hazmat-note {
      font-size: 7pt;
      font-style: italic;
      text-align: center;
      margin: 4px 0;
    }

    .hazmat-table {
      margin-top: 4px;
    }

    .hazmat-label {
      font-weight: bold;
      width: 30px;
    }

    /* Trailer Condition */
    .condition-section {
      border: 1px solid #000;
      margin-top: 4px;
    }

    .condition-header {
      background-color: #e0e0e0;
      font-weight: bold;
      padding: 2px 4px;
      display: grid;
      grid-template-columns: 1fr 40px 50px;
    }

    .condition-row {
      display: grid;
      grid-template-columns: 1fr 40px 50px;
      border-top: 1px solid #000;
    }

    .condition-row > div {
      padding: 2px 4px;
      border-right: 1px solid #000;
    }

    .condition-row > div:last-child {
      border-right: none;
    }

    /* Hazmat Totals */
    .hazmat-totals {
      margin-top: 8px;
    }

    .hazmat-totals-title {
      font-weight: bold;
      font-size: 10pt;
      text-align: center;
    }

    .totals-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      margin-top: 4px;
    }

    .totals-box {
      border: 1px solid #000;
    }

    .totals-box th {
      background-color: #333;
      color: #fff;
    }

    /* Dispatch Grid */
    .dispatch-grid {
    }

    .dispatch-grid th {
      font-size: 8pt;
      padding: 5px 6px;
    }

    .dispatch-grid td {
      min-height: 80px;
      padding: 8px 6px;
    }

    /* Freight Diagram */
    .freight-diagram {
      border: 2px solid #000;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }

    .freight-header {
      display: grid;
      grid-template-columns: 50px 1fr 1fr;
      background-color: #999;
      color: #fff;
      font-weight: bold;
      text-align: center;
    }

    .freight-header > div {
      padding: 2px 4px;
      border-right: 1px solid #000;
    }

    .freight-header > div:last-child {
      border-right: none;
    }

    .freight-diagram table {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }

    .freight-diagram tbody {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }

    .freight-diagram tr {
      flex-grow: 1;
      display: flex;
      border-bottom: 1px solid #000;
    }

    .freight-diagram tr:last-child {
      border-bottom: none;
    }

    .freight-diagram td {
      flex-grow: 1;
      display: flex;
      align-items: center;
      border-right: 1px solid #000;
    }

    .freight-diagram td:last-child {
      border-right: none;
    }

    .freight-cell {
      font-size: 9pt;
      padding: 4px 8px;
    }

    .freight-label {
      font-weight: bold;
      text-align: center;
      justify-content: center;
      background-color: #f0f0f0;
      width: 50px;
      min-width: 50px;
      flex-grow: 0 !important;
    }

    /* Footer */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 8px;
      padding-top: 4px;
      border-top: 1px solid #ccc;
    }

    .footer-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .qr-code img {
      width: 60px;
      height: 60px;
    }

    .compensation-note {
      font-size: 8pt;
      font-style: italic;
      max-width: 150px;
    }

    .footer-barcode img {
      height: 35px;
    }

    .printed-date {
      font-size: 8pt;
      color: #666;
    }
  </style>
</head>
<body>
  <!-- Page Title -->
  <div class="page-title">
    <svg height="50" viewBox="0 0 519.5 170.2" xmlns="http://www.w3.org/2000/svg">
      <polygon points="406.2,72.6 401.5,89 434.4,89 429.3,106.7 396.4,106.7 387.6,137.5 366.7,137.5 390.4,54.9 449,54.9 444,72.6 "/>
      <path d="M437.1,118.2c0.3-1.2,1.8-6.1,2-6.5l20.7,0l-0.9,3.1c-1.3,4.5-0.1,6.1,4.7,6.1h4.2c4.8,0,6.9-1.6,8.1-6.1c0,0,0.7-2.5,0.7-2.6c0.8-2.9-0.1-4.4-2.7-5c-7.4-1.8-16.3-4.1-19.4-5.2c-2.8-0.9-5.5-2.3-7.1-4.7c-2.3-3.4-1.8-8.2-0.5-12.7l3-10.4c3.9-13.6,13.1-20.5,27-20.5h16.4c13.9,0,19,7,15.1,20.4c-0.3,1.2-1.7,5.9-1.9,6.3h-20.7l0.8-2.9c1.3-4.6,0.1-6.1-4.6-6.1h-3.6c-5,0-7.2,1.6-8.5,6.1c0,0-0.6,2.1-0.6,2.1c-0.9,3.1,0.1,4.3,2.9,5c3.7,0.8,16.8,4.2,20.2,5.3c2.8,0.9,5.3,2.5,6.6,5c1.9,3.4,1.2,8.1,0,12.4l-3.1,10.7c-3.9,13.6-13,20.5-26.9,20.5h-16.7C438.4,138.7,433.2,131.7,437.1,118.2"/>
      <path d="M251.2,138.7H268c13.9,0,23-7,26.9-20.5c0.3-0.9,1.7-6,1.7-6.4h-20.7l-0.9,3.1c-1.3,4.5-3.4,6.1-8.1,6.1h-4.3c-4.8,0-5.9-1.6-4.6-6.1l10.7-37.2c1.3-4.6,3.4-6.1,8.1-6.1h4.3c4.8,0,5.9,1.5,4.6,6.1l-0.8,2.9h20.7c0.3-0.5,1.7-5.4,1.9-6.3c3.9-13.4-1.2-20.4-15.1-20.4h-16.8c-13.9,0-23,7-26.9,20.5l-12.6,43.9C232.2,131.7,237.3,138.7,251.2,138.7"/>
      <path d="M319.4,138.7h16.8c13.9,0,23-7,26.9-20.5c0.3-0.9,1.7-6,1.7-6.4H344l-0.9,3.1c-1.3,4.5-3.4,6.1-8.1,6.1h-4.3c-4.8,0-5.9-1.6-4.6-6.1l10.7-37.2c1.3-4.6,3.4-6.1,8.1-6.1h4.3c4.8,0,5.9,1.5,4.6,6.1l-0.8,2.9h20.7c0.3-0.5,1.7-5.4,1.9-6.3c3.9-13.4-1.2-20.4-15.1-20.4h-16.8c-13.9,0-23,7-26.9,20.5l-12.6,43.9C300.4,131.7,305.4,138.7,319.4,138.7"/>
      <path d="M238.5,63.3l-24.1-27.4l-3.9,4.7l-5.4-3.9c0.4-0.5,0.8-1.1,1.2-1.4l2.4-3.2c1.7-2.2,1.4-5.4-0.4-7.1c-0.7-0.5-1.4-0.9-2.2-1.1c-2.4-0.4-7.5,1.7-12.8,4.2L163.1,6.5c-1.8-1.2-4.2-1.2-6.2-0.3l-54.6,25.9l10.3-0.1L90.8,46.6l8.4-0.3c0,0-39.1,23.4-44.1,27c-3.4,2.4-7.1,4.6-9.9,7.8c-2,2.4-3.6,5.7-4.7,8.4c-4.2,9-6.3,17.8-6.3,17.8S42.5,99,44.5,99s4.2,15.7-2.5,22.1c-6.7,6.5-15,12.1-16.6,17.6c-1.1,3.7-0.7,14.5-0.4,21.1c-9.6,0.5-15.3,1.1-15.3,1.7c0,1.7,45.5,3.2,101.8,3.2c56.2,0,101.8-1.4,101.8-3.2c0-0.8-7.6-1.4-20.7-2c-14-17.6-24-31.1-12.9-54.8c0,0-0.3,3.2,0.1,7.4c0.4,3.7,1.2,8.3,3,12.4c4.2,9,15.9,22.4,15.9,22.4l0.9-7.5c0.4-2.9,1.4-5.7,3.3-7.9c2.2-2.8,5.4-4.7,9-5.5l9.7-2.2c1.2-0.3,2.2-1.2,2.5-2.4c2.5-8.4,12.5-43.6,15.4-53.6C240,66.2,239.6,64.5,238.5,63.3"/>
    </svg>
    <h1>Linehaul Loadsheet</h1>
  </div>

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div>
        <span style="font-weight: bold;">Trailer</span>
        <span class="trailer-number">${loadsheet.trailerNumber}</span>
      </div>
      <div class="barcode-section">
        ${mainBarcode ? `<img src="${mainBarcode}" alt="Barcode" />` : ''}
      </div>
    </div>
    <div class="header-right">
      <div class="manifest-label">Manifest Number</div>
      <div class="manifest-number">${loadsheet.manifestNumber}</div>
      <div class="manifest-label">Linehaul Name</div>
      <div class="linehaul-name">${loadsheet.linehaulName}</div>
    </div>
  </div>

  <div class="container">
    <!-- Left Column -->
    <div class="left-column">
      <!-- Loading Info -->
      <table class="loading-info">
        <tr>
          <td><strong>Date</strong></td>
          <td>${format(new Date(loadsheet.loadDate), 'MM/dd/yyyy')}</td>
          <td><strong>Length</strong></td>
          <td>${loadsheet.suggestedTrailerLength || 53}</td>
          <td><strong>Pintle Hook</strong></td>
          <td>${loadsheet.pintleHookRequired ? 'Yes' : 'No'}</td>
        </tr>
        <tr>
          <td><strong>Target Dispatch</strong></td>
          <td>${loadsheet.targetDispatchTime || ''}</td>
          <td><strong>Straps</strong></td>
          <td>${loadsheet.straps || ''}</td>
          <td><strong>Loadbars</strong></td>
          <td>${loadsheet.loadbars || ''}</td>
        </tr>
        <tr>
          <td><strong>Close Time</strong></td>
          <td>${loadsheet.closeTime || ''}</td>
          <td><strong>Seal Number</strong></td>
          <td colspan="3">${loadsheet.sealNumber || ''}</td>
        </tr>
      </table>

      <!-- Trailer Condition -->
      <div class="condition-section">
        <div class="condition-header">
          <div>Trailer Condition</div>
          <div style="text-align: center;">Ok</div>
          <div style="text-align: center;">Repair</div>
        </div>
        <div class="condition-row">
          <div>Wall</div>
          <div style="text-align: center;"></div>
          <div style="text-align: center;">${loadsheet.wallCondition === 'REPAIR' ? '\\u2713' : ''}</div>
        </div>
        <div class="condition-row">
          <div>Floor</div>
          <div style="text-align: center;"></div>
          <div style="text-align: center;">${loadsheet.floorCondition === 'REPAIR' ? '\\u2713' : ''}</div>
        </div>
        <div class="condition-row">
          <div>Roof</div>
          <div style="text-align: center;"></div>
          <div style="text-align: center;">${loadsheet.roofCondition === 'REPAIR' ? '\\u2713' : ''}</div>
        </div>
        <div class="condition-row">
          <div colspan="3">Comment: ${loadsheet.trailerConditionComment || ''}</div>
        </div>
      </div>

      <!-- HAZMAT Section -->
      <div class="hazmat-section">
        <div class="hazmat-title">HAZMAT ONLY</div>
        <div class="hazmat-note">**** Diagram and manifest all hazardous materials ****</div>
        <table class="hazmat-table">
          <thead>
            <tr>
              <th></th>
              <th>Pro Number</th>
              <th>Class</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            ${generateHazmatRows(loadsheet.hazmatItems)}
          </tbody>
        </table>
        <div class="placards">
          <div class="placards-title">Placards</div>
          <div class="placard-row">
            <div class="placard-item">
              <span class="checkbox ${placards.includes('CORROSIVE') ? 'checked' : ''}"></span>
              Corrosive
            </div>
            <div class="placard-item">
              <span class="checkbox ${placards.includes('FLAMMABLE') ? 'checked' : ''}"></span>
              Flammable
            </div>
            <div class="placard-item">
              <span class="checkbox ${placards.includes('DANGEROUS') ? 'checked' : ''}"></span>
              Dangerous
            </div>
            <div class="placard-item">
              <span class="checkbox ${placards.includes('OXIDIZER') ? 'checked' : ''}"></span>
              Oxidizer
            </div>
          </div>
          <div class="placard-row">
            <div class="placard-item">
              <span class="checkbox ${placards.includes('OTHER') ? 'checked' : ''}"></span>
              Other
            </div>
          </div>
        </div>
      </div>

      <!-- Hazmat Totals -->
      <div class="hazmat-totals">
        <div class="hazmat-totals-title">HAZMAT TOTALS</div>
        <div class="totals-grid">
          <table class="totals-box">
            <thead><tr><th>Class</th><th>Weight</th></tr></thead>
            <tbody>
              <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
              <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
            </tbody>
          </table>
          <table class="totals-box">
            <thead><tr><th>Class</th><th>Weight</th></tr></thead>
            <tbody>
              <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
              <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer Left -->
      <div class="footer-left">
        <div class="qr-code">
          ${qrCode ? `<img src="${qrCode}" alt="QR Code" />` : ''}
        </div>
        <div class="compensation-note">
          <strong>All drivers MUST depart and arrive their trips timely at driver.ccfs.com</strong>
        </div>
        <div class="footer-barcode">
          ${manifestBarcode ? `<img src="${manifestBarcode}" alt="Manifest Barcode" />` : ''}
        </div>
      </div>
    </div>

    <!-- Right Column -->
    <div class="right-column">
      <!-- Dispatch Grid -->
      <table class="dispatch-grid">
        <thead>
          <tr>
            <th>Dispatch Time</th>
            <th>Disp Term</th>
            <th>Next Term</th>
            <th>Tractor #</th>
            <th>Driver #</th>
            <th>Driver Name</th>
          </tr>
        </thead>
        <tbody>
          ${generateDispatchRows(loadsheet.dispatchEntries)}
        </tbody>
      </table>

      <!-- Small barcode under dispatch grid -->
      <div style="text-align: center; margin: 8px 0;">
        ${manifestBarcode ? `<img src="${manifestBarcode}" style="height: 80px;" alt="Manifest Barcode" />` : ''}
      </div>

      <!-- Freight Diagram -->
      <div class="freight-diagram">
        <div class="freight-header">
          <div>%</div>
          <div>Left</div>
          <div>Right</div>
        </div>
        <table style="width: 100%;">
          <tbody>
            ${generateFreightRows(loadsheet.freightPlacements)}
          </tbody>
        </table>
      </div>

      <!-- Printed Date -->
      <div class="printed-date" style="text-align: right;">
        Printed: ${format(printedAt, 'M/d/yyyy h:mm:ssaa')}
      </div>
    </div>
  </div>
</body>
</html>
  `;
};
