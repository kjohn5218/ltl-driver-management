import React from 'react';

interface RateConfirmationPage2Props {
  shipmentNumber: string;
}

export const RateConfirmationPage2: React.FC<RateConfirmationPage2Props> = ({ shipmentNumber }) => {
  return (
    <div className="rate-confirmation-page-2 bg-white p-6" style={{ width: '8.5in', minHeight: '11in', fontFamily: 'Arial, sans-serif' }}>

      {/* E-Signature Agreement Section */}
      <div className="border-2 border-black mb-4">
        <div className="bg-black text-white p-2 text-center font-bold">
          E-SIGNATURE AGREEMENT
        </div>
        <div style={{ minHeight: '400px' }} className="p-4">
          {/* Signature area - reduced height to fit on one page */}
        </div>
        
        {/* Signature Line */}
        <div className="flex justify-between items-end p-6">
          <div className="flex-1">
            <div className="mb-2">Carrier Signature</div>
            <div className="border-b-2 border-black w-full"></div>
          </div>
          <div className="mx-8">
            <div className="mb-2">Date</div>
            <div className="flex gap-2">
              <div className="border-b-2 border-black w-8"></div>
              <span>/</span>
              <div className="border-b-2 border-black w-8"></div>
              <span>/</span>
              <div className="border-b-2 border-black w-16"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Instructions */}
      <div className="mb-6 text-center">
        <div className="font-bold">Please email a copy of the rate confirmation, load manifest and invoice to: linehaulmanagement@ccfs.com.</div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-600 mt-8">
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