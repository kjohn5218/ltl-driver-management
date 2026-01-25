import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Upload, Download, AlertCircle, Check, X } from 'lucide-react';
import { driverService } from '../../services/driverService';
import { locationService } from '../../services/locationService';
import { Carrier, Location } from '../../types';

interface DriverImportProps {
  carriers: Carrier[];
  onImportComplete: () => void;
  onCancel: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export const DriverImport: React.FC<DriverImportProps> = ({
  carriers,
  onImportComplete,
  onCancel
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const locationsList = await locationService.getLocationsList();
      setLocations(locationsList);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `Carrier Name,Driver Name,Driver Number,Phone Number,Email,License Number,Location Code,Hazmat Endorsement
OLR TRANSPORTATION INC,John Doe,101,555-123-4567,john.doe@email.com,DL123456789,ABQ,Yes
ABC CARRIER,Jane Smith,102,555-987-6543,jane.smith@email.com,DL987654321,DEN,No`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'driver_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length === headers.length) {
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }
    }

    return data;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const fileType = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(fileType || '')) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }

    setFile(selectedFile);
    setResult(null);
  };

  const processImport = async () => {
    if (!file) return;

    setImporting(true);
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    try {
      const text = await file.text();
      const data = parseCSV(text);

      if (data.length === 0) {
        toast.error('No valid data found in file');
        setImporting(false);
        return;
      }

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2; // +2 because we skip header and arrays are 0-indexed

        try {
          // Find carrier by name
          const carrierName = row['Carrier Name'];
          const carrier = carriers.find(c => 
            c.name.toLowerCase().trim() === carrierName.toLowerCase().trim()
          );

          if (!carrier) {
            errors.push(`Row ${rowNumber}: Carrier "${carrierName}" not found`);
            failed++;
            continue;
          }

          // Validate required fields
          if (!row['Driver Name']) {
            errors.push(`Row ${rowNumber}: Driver name is required`);
            failed++;
            continue;
          }

          // Look up location by code if provided
          let locationId: number | undefined;
          const locationCode = row['Location Code'];
          if (locationCode) {
            const location = locations.find(l =>
              l.code.toLowerCase().trim() === locationCode.toLowerCase().trim()
            );
            if (location) {
              locationId = location.id;
            } else {
              errors.push(`Row ${rowNumber}: Location code "${locationCode}" not found (driver will be created without location)`);
            }
          }

          // Parse hazmat endorsement
          const hazmatValue = row['Hazmat Endorsement']?.toLowerCase().trim();
          const hazmatEndorsement = hazmatValue === 'yes' || hazmatValue === 'true' || hazmatValue === '1';

          // Create driver
          const driverData = {
            carrierId: carrier.id,
            name: row['Driver Name'],
            number: row['Driver Number'] || undefined,
            phoneNumber: row['Phone Number'] || undefined,
            email: row['Email'] || undefined,
            licenseNumber: row['License Number'] || undefined,
            locationId,
            hazmatEndorsement
          };

          await driverService.createDriver(driverData);
          success++;
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
          errors.push(`Row ${rowNumber}: ${errorMessage}`);
          failed++;
        }
      }

      setResult({ success, failed, errors });
      
      if (success > 0) {
        toast.success(`Successfully imported ${success} drivers`);
        onImportComplete();
      }
      
      if (failed > 0) {
        toast.error(`Failed to import ${failed} drivers`);
      }

    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to process import file');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Import Instructions</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Upload a CSV or Excel file with driver information</li>
                <li>Required columns: Carrier Name, Driver Name</li>
                <li>Optional columns: Driver Number, Phone Number, Email, License Number, Location Code, Hazmat Endorsement</li>
                <li>Carrier names must match exactly with existing carriers</li>
                <li>Location codes must match existing terminal/location codes</li>
                <li>Hazmat Endorsement: Use "Yes" or "No"</li>
                <li>Download the template below for the correct format</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Download Template */}
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-gray-900">Step 1: Download Template</h4>
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <Download className="h-4 w-4 mr-2" />
          Download CSV Template
        </button>
      </div>

      {/* File Upload */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Step 2: Upload Your File</h4>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
          <div className="space-y-1 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="flex text-sm text-gray-600">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
              >
                <span>Upload a file</span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">CSV, XLSX, XLS up to 10MB</p>
          </div>
        </div>

        {file && (
          <div className="mt-3 flex items-center">
            <Check className="h-5 w-5 text-green-500" />
            <span className="ml-2 text-sm text-gray-900">{file.name}</span>
            <button
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              className="ml-2 text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Import Results */}
      {result && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Import Results</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <div className="flex items-center">
                <Check className="h-5 w-5 text-green-400" />
                <span className="ml-2 text-sm font-medium text-green-800">
                  Success: {result.success}
                </span>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-center">
                <X className="h-5 w-5 text-red-400" />
                <span className="ml-2 text-sm font-medium text-red-800">
                  Failed: {result.failed}
                </span>
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <h5 className="text-sm font-medium text-red-800 mb-2">Errors:</h5>
              <div className="max-h-32 overflow-y-auto">
                <ul className="text-xs text-red-700 space-y-1">
                  {result.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={processImport}
          disabled={!file || importing}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md"
        >
          {importing ? 'Importing...' : 'Import Drivers'}
        </button>
      </div>
    </div>
  );
};