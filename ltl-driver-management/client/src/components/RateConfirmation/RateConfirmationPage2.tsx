import React from 'react';

interface RateConfirmationPage2Props {
  shipmentNumber: string;
}

export const RateConfirmationPage2: React.FC<RateConfirmationPage2Props> = ({ shipmentNumber }) => {
  return (
    <div className="rate-confirmation-page-2 bg-white p-2" style={{ width: '8.5in', minHeight: '11in', fontFamily: 'Arial, sans-serif' }}>

      {/* E-Signature Agreement Section */}
      <div className="border-2 border-black mb-2">
        <div className="bg-black text-white p-1 text-center font-bold">
          E-SIGNATURE AGREEMENT
        </div>
        <div style={{ minHeight: '120px' }} className="p-2">
          {/* Compact signature area */}
        </div>
        
        {/* Signature Line */}
        <div className="flex justify-between items-end p-3">
          <div className="flex-1">
            <div className="mb-1 text-sm">Carrier Signature</div>
            <div className="border-b-2 border-black w-full"></div>
          </div>
          <div className="mx-4">
            <div className="mb-1 text-sm">Date</div>
            <div className="flex gap-1 text-sm">
              <div className="border-b-2 border-black w-6"></div>
              <span>/</span>
              <div className="border-b-2 border-black w-6"></div>
              <span>/</span>
              <div className="border-b-2 border-black w-12"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Instructions */}
      <div className="mb-3 text-center">
        <div className="font-bold text-sm">Please email a copy of the rate confirmation, load manifest and invoice to: linehaulmanagement@ccfs.com.</div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-600 mt-4">
        <div className="mb-2">
          <span className="font-bold">Load # </span>
          <span className="italic">{shipmentNumber}</span>
          <span className="ml-8">Page 2 of 2</span>
          <span className="ml-8 italic">Rate Confirmation</span>
        </div>
      </div>
    </div>
  );
};