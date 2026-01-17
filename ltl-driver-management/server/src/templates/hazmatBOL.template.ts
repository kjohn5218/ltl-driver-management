/**
 * Hazmat BOL (Bill of Lading) HTML Template
 *
 * Generates a Bill of Lading document with hazmat information highlighted.
 */

import { format } from 'date-fns';

export interface HazmatBOLData {
  // Header
  accountNumber: string;
  shipperName: string;
  shipperAddress: string;
  shipperCity: string;
  shipperState: string;
  shipperZip: string;
  shipperPhone: string;
  proNumber: string;
  shipDate: Date;
  printDate: Date;
  billingTerms: string;

  // Consignee
  consigneeName: string;
  consigneeAddress: string;
  consigneeCity: string;
  consigneeState: string;
  consigneeZip: string;
  consigneePhone: string;

  // Reference
  quoteNumber?: string;
  quoteAmount?: number;

  // Hazmat materials
  hazmatMaterials: {
    units: number;
    pkgType: string;
    unNumber: string;
    description: string;
    hazmatClass: string;
    weight: number;
  }[];

  // Regular handling units
  handlingUnits: {
    units: number;
    pkgType: string;
    nmfcClass: string;
    description: string;
    dimensions?: string;
    weight: number;
  }[];

  // Totals
  hazmatTotalWeight: number;
  shipmentTotalUnits: number;
  shipmentTotalWeight: number;

  // Signatures
  pickupDriverSignature?: string;
  shipperSignature?: string;
  arriveTime?: string;
  departTime?: string;
  freightHasCCYQLabel?: boolean;
  shipperLoadAndCount?: boolean;
}

const formatDate = (date: Date, formatStr: string): string => {
  return format(date, formatStr);
};

const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

export const generateHazmatBOLHTML = (data: HazmatBOLData): string => {
  const hazmatRows = data.hazmatMaterials.map(item => `
    <tr>
      <td class="center">${item.units}</td>
      <td>${item.pkgType}</td>
      <td class="hazmat-desc">X ${item.unNumber}, ${item.description}, ${item.hazmatClass}</td>
      <td class="right">${item.weight.toLocaleString()}</td>
    </tr>
  `).join('');

  const hazmatTotalRow = data.hazmatMaterials.length > 0 ? `
    <tr class="total-row">
      <td class="center">${data.hazmatMaterials.reduce((sum, h) => sum + h.units, 0)}</td>
      <td colspan="2" class="center"><strong>HAZMAT TOTALS</strong></td>
      <td class="right"><strong>${data.hazmatTotalWeight.toLocaleString()}</strong></td>
    </tr>
  ` : '';

  const handlingRows = data.handlingUnits.map(item => `
    <tr>
      <td class="center">${item.units}</td>
      <td>${item.pkgType}</td>
      <td>${item.nmfcClass}</td>
      <td>${item.description}${item.dimensions ? `, ${item.dimensions}` : ''}</td>
      <td class="right">${item.weight.toLocaleString()}</td>
    </tr>
  `).join('');

  const shipmentTotalRow = `
    <tr class="total-row">
      <td class="center"><strong>${data.shipmentTotalUnits}</strong></td>
      <td colspan="3" class="center"><strong>SHIPMENT TOTALS</strong></td>
      <td class="right"><strong>${data.shipmentTotalWeight.toLocaleString()}</strong></td>
    </tr>
  `;

  // Generate hazmat summary
  const hazmatSummary = data.hazmatMaterials.reduce((acc, item) => {
    const key = item.hazmatClass;
    if (!acc[key]) {
      acc[key] = 0;
    }
    acc[key] += item.weight;
    return acc;
  }, {} as Record<string, number>);

  const hazmatSummaryLines = Object.entries(hazmatSummary).map(([cls, weight]) =>
    `<div>${weight.toLocaleString()} LB Class ${cls}</div>`
  ).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bill of Lading - ${data.proNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      line-height: 1.3;
      color: #000;
      background: #fff;
    }

    .page {
      width: 8.5in;
      min-height: 11in;
      padding: 0.3in;
      position: relative;
    }

    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
    }

    .shipper-info {
      flex: 2;
    }

    .account-number {
      font-size: 9px;
      margin-bottom: 3px;
    }

    .shipper-name {
      font-weight: bold;
      font-size: 11px;
    }

    .shipper-address {
      font-size: 10px;
    }

    .company-logo {
      flex: 1;
      text-align: center;
    }

    .logo-text {
      font-size: 24px;
      font-weight: bold;
      color: #003366;
    }

    .logo-subtitle {
      font-size: 10px;
      letter-spacing: 2px;
    }

    .dates-section {
      flex: 1;
      text-align: right;
    }

    .date-row {
      margin-bottom: 3px;
    }

    .date-label {
      font-size: 9px;
    }

    .date-value {
      font-weight: bold;
    }

    .barcode-section {
      text-align: center;
      margin: 15px 0;
      padding: 10px;
      border: 1px solid #000;
    }

    .barcode-bars {
      font-family: 'Libre Barcode 128', monospace;
      font-size: 40px;
      letter-spacing: 0;
    }

    .pro-number {
      font-size: 18px;
      font-weight: bold;
      margin-top: 5px;
    }

    .billing-terms {
      position: absolute;
      top: 0.3in;
      right: 0.3in;
      text-align: right;
    }

    .billing-label {
      font-size: 9px;
    }

    .billing-value {
      font-weight: bold;
    }

    .address-section {
      margin-bottom: 15px;
    }

    .address-label {
      font-weight: bold;
      font-size: 9px;
    }

    .address-content {
      font-size: 10px;
      margin-top: 3px;
    }

    .reference-section {
      margin-bottom: 15px;
      font-size: 10px;
    }

    .section-header {
      font-weight: bold;
      font-size: 11px;
      background: #f0f0f0;
      padding: 5px;
      margin-bottom: 5px;
      border-bottom: 1px solid #000;
    }

    .hazmat-section {
      margin-bottom: 15px;
    }

    .hazmat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .hazmat-title {
      font-weight: bold;
      font-size: 11px;
    }

    .emergency-response {
      font-size: 10px;
      font-weight: bold;
    }

    .materials-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }

    .materials-table th,
    .materials-table td {
      border: 1px solid #000;
      padding: 4px 6px;
      text-align: left;
    }

    .materials-table th {
      background: #f0f0f0;
      font-weight: bold;
      font-size: 9px;
    }

    .materials-table .center {
      text-align: center;
    }

    .materials-table .right {
      text-align: right;
    }

    .materials-table .hazmat-desc {
      font-size: 9px;
    }

    .materials-table .total-row {
      background: #f8f8f8;
    }

    .handling-section {
      margin-bottom: 15px;
    }

    .handling-header {
      font-weight: bold;
      font-size: 11px;
      margin-bottom: 5px;
    }

    .package-condition {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin: 15px 0;
      padding: 10px;
      border: 1px solid #ccc;
    }

    .condition-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 9px;
    }

    .checkbox {
      width: 12px;
      height: 12px;
      border: 1px solid #000;
      display: inline-block;
    }

    .certification-section {
      display: flex;
      gap: 20px;
      margin-top: 20px;
      padding: 10px;
      border: 1px solid #000;
    }

    .certification-left {
      flex: 2;
    }

    .certification-title {
      font-weight: bold;
      font-size: 10px;
      margin-bottom: 5px;
    }

    .certification-text {
      font-size: 8px;
      font-style: italic;
      line-height: 1.4;
    }

    .signature-line {
      margin-top: 20px;
      border-top: 1px solid #000;
      padding-top: 3px;
      font-size: 9px;
    }

    .hazmat-summary {
      flex: 1;
      text-align: right;
      padding: 10px;
      border: 2px solid #000;
      background: #fffde7;
    }

    .hazmat-summary-title {
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 10px;
    }

    .hazmat-summary-item {
      font-size: 11px;
      margin-bottom: 5px;
    }

    .hazmat-summary-total {
      font-weight: bold;
      font-size: 12px;
      margin-top: 10px;
      padding-top: 5px;
      border-top: 1px solid #000;
    }

    .manifest-totals {
      margin-top: 15px;
      padding: 10px;
      background: #f8f8f8;
      border: 1px solid #ccc;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
    }

    .signatures-section {
      display: flex;
      gap: 20px;
      margin-top: 20px;
      padding: 10px;
      border: 1px solid #ccc;
    }

    .signature-block {
      flex: 1;
    }

    .signature-label {
      font-size: 9px;
      margin-bottom: 20px;
    }

    .signature-field {
      border-bottom: 1px solid #000;
      min-height: 25px;
      margin-bottom: 5px;
    }

    .time-fields {
      display: flex;
      gap: 10px;
      font-size: 9px;
    }

    .checkbox-options {
      display: flex;
      gap: 15px;
      margin-top: 10px;
      font-size: 9px;
    }

    .important-notice {
      margin-top: 15px;
      padding: 10px;
      background: #fff3cd;
      border: 1px solid #ffc107;
      font-size: 9px;
    }

    .notice-title {
      font-weight: bold;
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
    <div class="header">
      <div class="shipper-info">
        <div class="account-number">Acct # ${data.accountNumber}</div>
        <div class="shipper-name">${data.shipperName}</div>
        <div class="shipper-address">${data.shipperAddress}</div>
        <div class="shipper-address">${data.shipperCity}, ${data.shipperState} ${data.shipperZip}</div>
      </div>

      <div class="company-logo">
        <div class="logo-text">CCFS</div>
        <div class="logo-subtitle">LTL + LOGISTICS</div>
      </div>

      <div class="dates-section">
        <div class="date-row">
          <span class="date-label">Ship Date:</span>
          <span class="date-value">${formatDate(data.shipDate, 'M/d/yyyy')}</span>
        </div>
        <div class="date-row">
          <span class="date-label">Print Date:</span>
          <span class="date-value">${formatDate(data.printDate, 'M/d/yyyy h:mm a')}</span>
        </div>
        <div class="date-row">
          <span class="date-label">Page Num:</span>
          <span class="date-value">1 of 1</span>
        </div>
      </div>
    </div>

    <div class="billing-terms">
      <span class="billing-label">Billing Terms:</span>
      <span class="billing-value">${data.billingTerms}</span>
    </div>

    <div class="barcode-section">
      <div class="barcode-bars">|||||||||||||||||||||||||||||||</div>
      <div class="pro-number">Pro #: ${data.proNumber}</div>
    </div>

    <div class="address-section">
      <div class="address-label">Shipper: ${data.accountNumber}, ${data.shipperName}, ${data.shipperAddress}, ${data.shipperCity}, ${data.shipperState}, ${data.shipperPhone}</div>
    </div>

    <div class="address-section">
      <div class="address-label">Consignee: ${data.consigneeName}, ${data.consigneeAddress}, ${data.consigneeCity}, ${data.consigneeState} ${data.consigneeZip}, ${data.consigneePhone}</div>
    </div>

    ${data.quoteNumber ? `
    <div class="reference-section">
      <strong>Reference:</strong> Quote: ${data.quoteNumber} (${formatCurrency(data.quoteAmount || 0)})
    </div>
    ` : ''}

    <div class="hazmat-section">
      <div class="hazmat-header">
        <div class="hazmat-title">Hazardous Materials:</div>
        <div class="emergency-response">Emergency Response: 800-424-9300 CHEMTREC</div>
      </div>

      <table class="materials-table">
        <thead>
          <tr>
            <th class="center" style="width: 50px;">Units</th>
            <th style="width: 60px;">Pkg Type</th>
            <th>HM Description</th>
            <th class="right" style="width: 80px;">Weight</th>
          </tr>
        </thead>
        <tbody>
          ${hazmatRows}
          ${hazmatTotalRow}
        </tbody>
      </table>
    </div>

    <div class="handling-section">
      <div class="handling-header">Handling Units:</div>
      <table class="materials-table">
        <thead>
          <tr>
            <th class="center" style="width: 50px;">Units</th>
            <th style="width: 60px;">Pkg Type</th>
            <th style="width: 50px;">Class</th>
            <th>Description</th>
            <th class="right" style="width: 80px;">Weight</th>
          </tr>
        </thead>
        <tbody>
          ${handlingRows}
          ${shipmentTotalRow}
        </tbody>
      </table>
    </div>

    <div class="package-condition">
      <div class="condition-item"><span class="checkbox"></span> Y <span class="checkbox"></span> N Shrink Wrapped</div>
      <div class="condition-item"><span class="checkbox"></span> Y <span class="checkbox"></span> N Banded</div>
      <div class="condition-item"><span class="checkbox"></span> Y <span class="checkbox"></span> N New Box</div>
      <div class="condition-item"><span class="checkbox"></span> Y <span class="checkbox"></span> N Crated</div>
      <div class="condition-item"><span class="checkbox"></span> Y <span class="checkbox"></span> N Not Responsible for Damage</div>
      <div class="condition-item"><span class="checkbox"></span> Y <span class="checkbox"></span> N Shrink Wrap Intact</div>
      <div class="condition-item"><span class="checkbox"></span> Y <span class="checkbox"></span> N Factory Packaging</div>
      <div class="condition-item"><span class="checkbox"></span> Y <span class="checkbox"></span> N Used Box</div>
      <div class="condition-item"><span class="checkbox"></span> Y <span class="checkbox"></span> N Ripped / Torn</div>
      <div class="condition-item">Other (Please specify)</div>
      <div class="condition-item"><span class="checkbox"></span> Y <span class="checkbox"></span> N Repacked / Retaped</div>
      <div class="condition-item"><span class="checkbox"></span> Y <span class="checkbox"></span> N Not Boxed or Crated</div>
      <div class="condition-item"><span class="checkbox"></span> Y <span class="checkbox"></span> N Box Crushed</div>
    </div>

    <div class="certification-section">
      <div class="certification-left">
        <div class="certification-title">Hazmat Shipper's Certification (&sect;172.204)</div>
        <div class="certification-text">
          This is to certify that the above-named materials are properly classified, described, packaged, marked and labeled,
          are in proper condition for transportation according to the applicable regulations of the Department of Transport.
        </div>
        <div class="signature-line">
          Shipper Signature: _________________________________
        </div>
      </div>

      <div class="hazmat-summary">
        <div class="hazmat-summary-title">HAZMAT SUMMARY</div>
        ${hazmatSummaryLines}
        <div class="hazmat-summary-total">${data.hazmatTotalWeight.toLocaleString()} LB Total</div>
      </div>
    </div>

    <div class="manifest-totals">
      <div class="totals-row">
        <span><strong>Manifest Totals:</strong> ${data.shipmentTotalUnits} SHIPMENTS, ${data.shipmentTotalUnits} UNITS, ${data.shipmentTotalWeight.toLocaleString()} LBS</span>
      </div>
    </div>

    <div class="signatures-section">
      <div class="signature-block">
        <div class="signature-label">Pickup Driver:</div>
        <div class="signature-field"></div>
        <div class="time-fields">
          <span>Arrive Time: ___:___ AM PM</span>
          <span>Depart Time: ___:___ AM PM</span>
        </div>
      </div>
      <div class="signature-block">
        <div class="signature-label">Shipper Signature:</div>
        <div class="signature-field"></div>
        <div class="checkbox-options">
          <span><span class="checkbox"></span> Freight has CCYQ Label</span>
          <span><span class="checkbox"></span> Shipper Load and Count</span>
        </div>
      </div>
    </div>

    <div class="important-notice">
      <span class="notice-title">Important Notice:</span> By signing this manifest you, the shipper, have confirmed all information is correct. If any information
      needs to be changed after the shipments have been picked up by CrossCountry Freight Solutions, a BOL Correction fee will be
      added to the bill.
    </div>
  </div>
</body>
</html>
  `;
};
