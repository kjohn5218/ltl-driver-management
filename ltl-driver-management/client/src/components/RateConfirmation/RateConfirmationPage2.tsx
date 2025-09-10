import React from 'react';

interface RateConfirmationPage2Props {
  shipmentNumber: string;
}

export const RateConfirmationPage2: React.FC<RateConfirmationPage2Props> = ({ shipmentNumber }) => {
  return (
    <div className="rate-confirmation-page-2 bg-white p-1" style={{ width: '8.5in', minHeight: '11in', fontFamily: 'Arial, sans-serif' }}>

      {/* E-Signature Agreement Section */}
      <div className="border-2 border-black mb-1">
        <div className="bg-black text-white p-1 text-center font-bold text-xs">
          E-SIGNATURE AGREEMENT
        </div>
        <div style={{ minHeight: '30px' }} className="p-1">
          {/* Minimal signature area */}
        </div>
        
        {/* Signature Line */}
        <div className="flex justify-between items-end p-1">
          <div className="flex-1">
            <div className="text-xs">Carrier Signature</div>
            <div className="border-b-2 border-black w-full"></div>
          </div>
          <div className="mx-2">
            <div className="text-xs">Date</div>
            <div className="flex gap-1 text-xs">
              <div className="border-b border-black w-4"></div>
              <span>/</span>
              <div className="border-b border-black w-4"></div>
              <span>/</span>
              <div className="border-b border-black w-8"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Instructions */}
      <div className="mb-2 text-center">
        <div className="font-bold text-xs">Please email a copy of the rate confirmation, load manifest and invoice to: linehaulmanagement@ccfs.com.</div>
      </div>
    </div>
  );
};