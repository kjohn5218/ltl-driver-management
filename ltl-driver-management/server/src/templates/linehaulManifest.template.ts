/**
 * Linehaul Manifest HTML Template
 *
 * Generates a multi-page manifest document matching the provided design.
 */

import { format } from 'date-fns';

export interface ManifestFreightItem {
  proNumber: string;
  destTerminal: string;
  destTerminalSub?: string;
  scans: number;
  pieces: number;
  weight: number;
  consigneeName?: string;
  consigneeCity?: string;
  shipperName?: string;
  shipperCity?: string;
  expDeliveryDate?: string;
  loadedTerminal?: string;
  unloadedTerminal?: string;
  isHazmat: boolean;
}

export interface ManifestData {
  tripDisplay: string;
  manifestNumber: string;
  driverName?: string;
  trailerNumber?: string;
  originCode: string;
  destCode: string;
  effort?: string;
  timeDue?: string;
  lastLoad?: string;
  totalScans: number;
  totalPieces: number;
  totalWeight: number;
  freightItems: ManifestFreightItem[];
  dispatchedAt?: Date;
  arrivedAt?: Date;
  printedAt: Date;
  qrCodeDataUrl?: string;
}

const ITEMS_PER_PAGE = 20;

const formatDate = (date: Date | undefined, formatStr: string): string => {
  if (!date) return '';
  return format(date, formatStr);
};

const generateFreightRow = (item: ManifestFreightItem, _index: number): string => {
  const hmIndicator = item.isHazmat ? '<span class="hm-indicator">H<br/>A<br/>Z</span>' : '';

  return `
    <tr>
      <td class="pro-number">${item.proNumber}</td>
      <td class="terminal-cell">
        <div class="dest-terminal">${item.destTerminal || ''}</div>
        <div class="terminal-sub">${item.destTerminalSub || ''}</div>
        <div class="exp-delv">${item.expDeliveryDate || ''}</div>
      </td>
      <td class="numeric">${item.scans}</td>
      <td class="numeric">${item.pieces}</td>
      <td class="numeric">${item.weight.toLocaleString()}</td>
      <td class="consignee-cell">
        <div class="consignee-name"><strong>${item.consigneeName || ''}</strong> ${item.consigneeCity || ''}</div>
        <div class="shipper-name">${item.shipperName || ''} ${item.shipperCity || ''}</div>
      </td>
      <td class="loaded-unloaded">
        <div>${item.loadedTerminal || ''}</div>
        <div><strong>${item.unloadedTerminal || ''}</strong></div>
      </td>
      <td class="hazmat-col">${hmIndicator}</td>
    </tr>
  `;
};

const generatePage = (
  data: ManifestData,
  pageItems: ManifestFreightItem[],
  pageNumber: number,
  totalPages: number,
  isFirstPage: boolean
): string => {
  const headerSection = isFirstPage
    ? `
    <div class="header-section">
      <div class="manifest-info">
        <table class="manifest-table">
          <tr>
            <td class="label">Manifest</td>
            <td class="value manifest-number"><strong>${data.manifestNumber}</strong></td>
            <td class="label">Name</td>
            <td class="value name-value"><strong>${data.driverName || ''}</strong></td>
          </tr>
          <tr>
            <td class="label">Trailer</td>
            <td class="value"><strong>${data.trailerNumber || ''}</strong></td>
            <td class="label">Orig</td>
            <td class="value origin-dest"><strong>${data.originCode}</strong></td>
            <td class="label">Dest</td>
            <td class="value origin-dest"><strong>${data.destCode}</strong></td>
          </tr>
        </table>
      </div>
      <div class="workload-section">
        <div class="workload-header">Workload</div>
        <table class="workload-table">
          <tr>
            <td class="label">Effort</td>
            <td class="value"><u>${data.effort || ''}</u></td>
          </tr>
          <tr>
            <td class="label">Time Due</td>
            <td class="value"></td>
          </tr>
          <tr>
            <td class="label">Last Load</td>
            <td class="value">${data.lastLoad || ''}</td>
          </tr>
        </table>
      </div>
      <div class="dispatch-section">
        <div class="dispatch-header">Dispatch/Arrive</div>
        ${data.qrCodeDataUrl ? `<img src="${data.qrCodeDataUrl}" class="qr-code" alt="QR Code"/>` : '<div class="qr-placeholder"></div>'}
        <div class="qr-label">driver.ccfs.com</div>
      </div>
    </div>

    <div class="terminals-totals-section">
      <div class="terminals-section">
        <div class="terminals-label">Contains Freight for the Following Terminals</div>
        <div class="terminals-box">
          <strong>${data.destCode}</strong>
        </div>
      </div>
      <div class="totals-section">
        <div class="totals-header">Totals</div>
        <table class="totals-table">
          <tr><td class="label">Scans</td><td class="value"><strong>${data.totalScans}</strong></td></tr>
          <tr><td class="label">Pieces</td><td class="value"><strong>${data.totalPieces}</strong></td></tr>
          <tr><td class="label">Weight</td><td class="value"><strong>${data.totalWeight.toLocaleString()}</strong></td></tr>
        </table>
      </div>
    </div>
    `
    : '';

  const freightRows = pageItems.map((item, index) => generateFreightRow(item, index)).join('');

  return `
    <div class="page">
      <div class="page-header">
        <div class="trip-id">${data.tripDisplay}</div>
        <div class="document-title">LINEHAUL MANIFEST</div>
      </div>

      ${headerSection}

      <table class="freight-table">
        <thead>
          <tr>
            <th class="pro-header">Pro Num</th>
            <th class="terminal-header">
              <div>Dest</div>
              <div>Terminal</div>
            </th>
            <th class="numeric-header">Scans</th>
            <th class="numeric-header">Pieces</th>
            <th class="numeric-header">Weight</th>
            <th class="consignee-header">Consignee / Shipper</th>
            <th class="loaded-header">
              <div>Loaded</div>
              <div>Unloaded</div>
            </th>
            <th class="hazmat-header">HM</th>
          </tr>
        </thead>
        <tbody>
          ${freightRows}
        </tbody>
      </table>

      <div class="page-footer">
        <div class="footer-left">
          <div class="printed-info">Printed</div>
          <div class="printed-date">${formatDate(data.printedAt, 'M/d/yyyy h:mm a')} CST</div>
        </div>
        <div class="footer-center">
          <div class="dispatch-info">Dispatched</div>
          <div class="dispatch-date">${data.dispatchedAt ? formatDate(data.dispatchedAt, 'M/d/yyyy h:mm a') + ' MST' : ''}</div>
        </div>
        <div class="footer-center">
          <div class="arrive-info">Arrived</div>
          <div class="arrive-date">${data.arrivedAt ? formatDate(data.arrivedAt, 'M/d/yyyy h:mm a') + ' MST' : ''}</div>
        </div>
        <div class="footer-right">
          <div class="manifest-id">${data.manifestNumber} ${data.originCode}</div>
          <div class="page-number">Page ${pageNumber} of ${totalPages}</div>
        </div>
      </div>
    </div>
  `;
};

export const generateLinehaulManifestHTML = (data: ManifestData): string => {
  // Calculate pages
  const totalPages = Math.ceil(data.freightItems.length / ITEMS_PER_PAGE) || 1;
  const pages: string[] = [];

  for (let i = 0; i < totalPages; i++) {
    const startIdx = i * ITEMS_PER_PAGE;
    const pageItems = data.freightItems.slice(startIdx, startIdx + ITEMS_PER_PAGE);
    pages.push(generatePage(data, pageItems, i + 1, totalPages, i === 0));
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Linehaul Manifest - ${data.manifestNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      line-height: 1.2;
      color: #000;
      background: #fff;
    }

    .page {
      width: 8.5in;
      min-height: 11in;
      padding: 0.3in;
      page-break-after: always;
      position: relative;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      border-bottom: 2px solid #000;
      padding-bottom: 5px;
    }

    .trip-id {
      font-size: 16px;
      font-weight: bold;
    }

    .document-title {
      font-size: 18px;
      font-weight: bold;
    }

    .header-section {
      display: flex;
      gap: 15px;
      margin-bottom: 10px;
    }

    .manifest-info {
      flex: 2;
      border: 1px solid #000;
      padding: 5px;
    }

    .manifest-table {
      width: 100%;
      border-collapse: collapse;
    }

    .manifest-table td {
      padding: 2px 5px;
    }

    .manifest-table .label {
      width: 50px;
      font-size: 9px;
    }

    .manifest-table .value {
      border-bottom: 1px solid #000;
      font-size: 11px;
    }

    .manifest-number {
      font-size: 14px !important;
    }

    .name-value {
      font-size: 12px !important;
    }

    .origin-dest {
      width: 40px;
    }

    .workload-section {
      flex: 1;
      border: 1px solid #000;
      padding: 5px;
    }

    .workload-header {
      font-weight: bold;
      font-size: 9px;
      text-align: center;
      margin-bottom: 5px;
    }

    .workload-table {
      width: 100%;
    }

    .workload-table td {
      padding: 2px;
      font-size: 9px;
    }

    .workload-table .value {
      text-align: right;
      font-weight: bold;
    }

    .dispatch-section {
      flex: 1;
      border: 1px solid #000;
      padding: 5px;
      text-align: center;
    }

    .dispatch-header {
      font-weight: bold;
      font-size: 9px;
      margin-bottom: 5px;
    }

    .qr-code {
      width: 60px;
      height: 60px;
    }

    .qr-placeholder {
      width: 60px;
      height: 60px;
      margin: 0 auto;
      border: 1px dashed #ccc;
    }

    .qr-label {
      font-size: 8px;
      margin-top: 2px;
    }

    .terminals-totals-section {
      display: flex;
      gap: 15px;
      margin-bottom: 10px;
    }

    .terminals-section {
      flex: 3;
      border: 1px solid #000;
      padding: 5px;
    }

    .terminals-label {
      font-size: 9px;
      margin-bottom: 5px;
    }

    .terminals-box {
      font-size: 14px;
      padding: 5px;
    }

    .totals-section {
      flex: 1;
      border: 1px solid #000;
      padding: 5px;
    }

    .totals-header {
      font-weight: bold;
      font-size: 9px;
      text-align: right;
      margin-bottom: 5px;
    }

    .totals-table {
      width: 100%;
    }

    .totals-table td {
      padding: 1px 5px;
      font-size: 10px;
    }

    .totals-table .label {
      text-align: left;
    }

    .totals-table .value {
      text-align: right;
      font-size: 12px;
    }

    .freight-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }

    .freight-table th,
    .freight-table td {
      border: 1px solid #000;
      padding: 3px 4px;
      text-align: left;
      vertical-align: top;
    }

    .freight-table th {
      background: #f0f0f0;
      font-weight: bold;
      font-size: 9px;
    }

    .pro-header, .pro-number {
      width: 90px;
    }

    .terminal-header, .terminal-cell {
      width: 70px;
    }

    .numeric-header, .numeric {
      width: 45px;
      text-align: center !important;
    }

    .consignee-header, .consignee-cell {
      width: auto;
    }

    .loaded-header, .loaded-unloaded {
      width: 55px;
      text-align: center !important;
    }

    .hazmat-header, .hazmat-col {
      width: 25px;
      text-align: center !important;
    }

    .dest-terminal {
      font-weight: bold;
      font-size: 10px;
    }

    .terminal-sub {
      font-size: 8px;
      color: #333;
    }

    .exp-delv {
      font-size: 8px;
      color: #666;
    }

    .consignee-name {
      font-size: 9px;
    }

    .shipper-name {
      font-size: 8px;
      color: #666;
      font-style: italic;
    }

    .hm-indicator {
      font-size: 7px;
      font-weight: bold;
      line-height: 1;
    }

    .page-footer {
      position: absolute;
      bottom: 0.3in;
      left: 0.3in;
      right: 0.3in;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 8px;
      border-top: 1px solid #000;
      padding-top: 5px;
    }

    .footer-left,
    .footer-center,
    .footer-right {
      text-align: center;
    }

    .footer-left {
      text-align: left;
    }

    .footer-right {
      text-align: right;
    }

    .printed-date,
    .dispatch-date,
    .arrive-date {
      font-size: 8px;
    }

    .manifest-id {
      font-weight: bold;
    }

    @media print {
      .page {
        margin: 0;
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  ${pages.join('')}
</body>
</html>
  `;
};
