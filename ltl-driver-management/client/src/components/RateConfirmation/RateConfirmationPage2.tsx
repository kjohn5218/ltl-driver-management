import React from 'react';

interface RateConfirmationPage2Props {
  shipmentNumber: string;
}

export const RateConfirmationPage2: React.FC<RateConfirmationPage2Props> = ({ shipmentNumber }) => {
  return (
    <div className="rate-confirmation-page-2 bg-white p-8" style={{ width: '8.5in', minHeight: '11in', fontFamily: 'Arial, sans-serif' }}>
      {/* Important Notes */}
      <div className="mb-6 text-sm">
        <div className="mb-2">
          <span className="font-bold">Maintain Seal Integrity</span> - seal each load at shippers dock - record on BOL - only allow consignee to remove seal.
        </div>
        <div className="mb-2">
          <span className="font-bold">Notify CCFS of all delays</span>
        </div>
        <div className="mb-2">
          <span className="font-bold">Advise CCFS upon arrival & departure of each stop.</span>
        </div>
        <div className="mb-2">
          <span className="font-bold">Immediately advise CCFS of any discrepancies, over-short or damaged . Do Not leave customer until we have the discrepancy resolved.</span>
        </div>
      </div>

      <div className="mb-8 text-center">
        <div className="font-bold">PLEASE EMAIL A COPY OF THE RATE CONFIRMATION, POD & INVOICE TO: splinehaul@necompanies.com</div>
      </div>

      {/* E-Signature Agreement Section */}
      <div className="border-2 border-black">
        <div className="bg-black text-white p-2 text-center font-bold">
          E-SIGNATURE AGREEMENT
        </div>
        <div style={{ minHeight: '600px' }} className="p-4">
          {/* Large blank space for signature area */}
        </div>
        
        {/* Signature Line */}
        <div className="flex justify-between items-end p-8">
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