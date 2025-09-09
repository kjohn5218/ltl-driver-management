import React from 'react';
import { Booking } from '../../types';
import { format } from 'date-fns';

interface RateConfirmationProps {
  booking: Booking;
  shipmentNumber: string;
}

export const RateConfirmation: React.FC<RateConfirmationProps> = ({ booking, shipmentNumber }) => {
  const currentDate = format(new Date(), 'EEEE, MMMM d, yyyy h:mm a');
  
  return (
    <div className="rate-confirmation bg-white p-8" style={{ width: '8.5in', minHeight: '11in', fontFamily: 'Arial, sans-serif' }}>
      {/* Logo */}
      <div className="text-center mb-4">
        <img src="/ccfs-logo.svg" alt="CCFS Logo" className="h-20 mx-auto" />
      </div>

      {/* Company Info */}
      <div className="text-center mb-4">
        <div className="font-bold text-xl">CrossCounty Freight Solutions</div>
        <div>1929 Hancock Dr</div>
        <div>Bismarck, ND 58502</div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="font-bold text-lg">Load # {shipmentNumber}</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold">Rate Confirmation</div>
          <div className="text-sm text-gray-600">{currentDate} (Central Standard Time)</div>
        </div>
      </div>

      {/* From/To Section */}
      <table className="w-full border-2 border-black mb-4">
        <thead>
          <tr className="bg-black text-white">
            <th colSpan={2} className="text-center py-1">FROM</th>
            <th className="text-center py-1">DATE</th>
            <th className="text-center py-1">TIME</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-black">
            <td className="p-2 font-semibold">FROM</td>
            <td className="p-2" colSpan={3}>{booking.route?.origin}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="p-2 font-semibold">CARRIER</td>
            <td className="p-2">{booking.carrier?.name || 'TBD'}</td>
            <td className="p-2">{format(new Date(booking.bookingDate), 'MM/dd/yyyy')}</td>
            <td className="p-2">21:00</td>
          </tr>
        </tbody>
      </table>

      {/* To Section */}
      <table className="w-full border-2 border-black mb-4">
        <thead>
          <tr className="bg-black text-white">
            <th colSpan={2} className="text-center py-1">TO</th>
            <th className="text-center py-1">ATT</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-black">
            <td className="p-2 font-semibold">CARRIER</td>
            <td className="p-2">{booking.route?.destination}</td>
            <td className="p-2">{booking.route?.destinationContact || ''}</td>
          </tr>
          <tr className="border-b border-black">
            <td className="p-2 font-semibold bg-black text-white text-center">PHONE</td>
            <td className="p-2">{booking.carrier?.phone || ''}</td>
            <td className="p-2 font-semibold bg-black text-white text-center">FAX</td>
          </tr>
        </tbody>
      </table>

      {/* Vehicle Information */}
      <table className="w-full border-2 border-black mb-4">
        <thead>
          <tr className="bg-gray-200">
            <th className="border-r border-black p-2 text-left">MC #</th>
            <th className="border-r border-black p-2 text-left">DOT #</th>
            <th className="border-r border-black p-2 text-left">TRUCK #</th>
            <th className="border-r border-black p-2 text-left">TRAILER #</th>
            <th className="border-r border-black p-2 text-left">DRIVER</th>
            <th className="border-r border-black p-2 text-left">DRIVER CELL</th>
            <th className="p-2 text-left">PU REF</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-r border-black p-2">{booking.carrier?.mcNumber || ''}</td>
            <td className="border-r border-black p-2">{booking.carrier?.dotNumber || ''}</td>
            <td className="border-r border-black p-2"></td>
            <td className="border-r border-black p-2"></td>
            <td className="border-r border-black p-2">{booking.driverName || 'PJ -'}</td>
            <td className="border-r border-black p-2">{booking.phoneNumber || '(408) 396-5404'}</td>
            <td className="p-2"></td>
          </tr>
        </tbody>
      </table>

      {/* Size & Type / Description */}
      <table className="w-full border-2 border-black mb-4">
        <thead>
          <tr className="bg-gray-200">
            <th className="border-r border-black p-2 text-left">SIZE & TYPE</th>
            <th className="border-r border-black p-2 text-left">DESCRIPTION</th>
            <th className="border-r border-black p-2 text-left">PIECES</th>
            <th className="border-r border-black p-2 text-left">TOTAL WEIGHT</th>
            <th className="p-2 text-left">MILES</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-r border-black p-2">
              {booking.type === 'POWER_AND_TRAILER' && booking.trailerLength 
                ? `${booking.trailerLength} FT` 
                : 'Van 53 FT'}
            </td>
            <td className="border-r border-black p-2">FAK</td>
            <td className="border-r border-black p-2">0</td>
            <td className="border-r border-black p-2">35,000.00 LB</td>
            <td className="p-2">{booking.route?.distance || '184.00'}</td>
          </tr>
        </tbody>
      </table>

      {/* Carrier ETA and Notes */}
      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <div>Carrier ETA:</div>
          <div>Seal Number:</div>
        </div>
        <div className="border-2 border-black p-2 bg-gray-100">
          <div className="font-bold text-center mb-2">NOTES</div>
          <div className="text-sm">
            After hours dispatch between the hours of 9:30 PM -6:30 AM CT please call 701-204-0480. If you are going to be delayed for any
            reason during these hours, please make sure to call and notify us. Or if you are needing assistance of any kind during
            these hours, please call us.
          </div>
          {booking.notes && (
            <div className="mt-2 text-sm">{booking.notes}</div>
          )}
        </div>
      </div>

      {/* Description Table */}
      <table className="w-full border-2 border-black mb-4">
        <thead>
          <tr className="bg-black text-white">
            <th className="p-2 text-left">DESCRIPTION</th>
            <th className="p-2 text-left">WEIGHT</th>
            <th className="p-2 text-left">HANDLING UNITS</th>
            <th className="p-2 text-left">HAZMAT</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-2">FAK</td>
            <td className="p-2">35,000.00 LB</td>
            <td className="p-2"></td>
            <td className="p-2"></td>
          </tr>
        </tbody>
      </table>

      {/* Pickup Location */}
      <div className="border-2 border-black mb-4">
        <div className="bg-black text-white p-2 text-center font-bold">Pickup Location (Leg 1)</div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div><span className="font-bold">Name:</span> CrossCounty Freight Solutions - RNO</div>
              <div><span className="font-bold">Address:</span> {booking.route?.originAddress || '985 Glendale Avenue'}</div>
              <div><span className="font-bold">Address:</span></div>
              <div><span className="font-bold">City, State Zip:</span> {booking.route?.originCity || 'SPARKS'}, {booking.route?.originState || 'NV'} {booking.route?.originZipCode || '89431'}</div>
            </div>
            <div>
              <div><span className="font-bold">Phone:</span> (775) 331-2311</div>
              <div><span className="font-bold">Contact:</span> {booking.route?.originContact || 'Brian Smith'}</div>
              <div><span className="font-bold">Appt Date/Time:</span> {format(new Date(booking.bookingDate), 'MM/dd/yyyy')} 21:00</div>
              <div className="mt-4">
                <div><span className="font-bold">PO #:</span></div>
                <div><span className="font-bold">Hours:</span> 04:00 -to-10:00</div>
                <div><span className="font-bold">Pickup Conf#:</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-2 border-black p-2 mb-4 text-center bg-gray-100">
        CHECK IN WITH DISIPATCH FOR LIVE LOAD AND PAPERWORK
      </div>

      {/* Drop Location */}
      <div className="border-2 border-black mb-4">
        <div className="bg-black text-white p-2 text-center font-bold">Drop Location (Leg 2)</div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div><span className="font-bold">Name:</span> DDP</div>
              <div><span className="font-bold">Address:</span> {booking.route?.destinationAddress || '2800 S El Dorado ST'}</div>
              <div><span className="font-bold">Address:</span></div>
              <div><span className="font-bold">City, State Zip:</span> {booking.route?.destinationCity || 'STOCKTON'}, {booking.route?.destinationState || 'CA'} {booking.route?.destinationZipCode || '95206'}</div>
            </div>
            <div>
              <div><span className="font-bold">Phone:</span></div>
              <div><span className="font-bold">Contact:</span> {booking.route?.destinationContact || ''}</div>
              <div><span className="font-bold">Appt Date/Time:</span> {format(new Date(booking.bookingDate), 'MM/dd/yyyy')} 02:30</div>
              <div className="mt-4">
                <div><span className="font-bold">PO #:</span></div>
                <div><span className="font-bold">Hours:</span></div>
                <div><span className="font-bold">Delivery Conf#:</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-2 border-black p-2 mb-6 text-center bg-gray-100">
        GATE CODE IS 4569. DRIVER CAN BACK IN TO ANY OPEN DOOR BETWEEN 1 THRU 6
      </div>

      {/* Charges */}
      <table className="w-full border-2 border-black mb-4">
        <thead>
          <tr className="bg-black text-white">
            <th colSpan={2} className="p-2 text-center">CHARGES</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-black">
            <td className="p-2">Freight Charge</td>
            <td className="p-2 text-right">${booking.rate}</td>
          </tr>
          <tr className="bg-gray-100">
            <td className="p-2 font-bold">TOTAL RATE</td>
            <td className="p-2 text-right font-bold">${booking.rate} US Dollars</td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div className="text-center text-sm text-gray-600 mt-8">
        <div className="mb-2">
          <span className="font-bold">Load # </span>
          <span className="italic">{shipmentNumber}</span>
          <span className="ml-8">Page 1 of 2</span>
          <span className="ml-8 italic">Rate Confirmation</span>
        </div>
      </div>
    </div>
  );
};