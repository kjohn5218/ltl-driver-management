import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Check, X, Loader, FileText } from 'lucide-react';
import { api } from '../services/api';

interface BookingData {
  id: number;
  bookingDate: string;
  rate: string;
  carrier: {
    name: string;
  };
  route: {
    origin: string;
    destination: string;
    distance: string;
  };
  childBookings?: Array<{
    route: {
      origin: string;
      destination: string;
      distance: string;
    };
    rate: string;
  }>;
  type: string;
  trailerLength?: number;
  driverName?: string;
  phoneNumber?: string;
  notes?: string;
}

// Parse multi-leg booking information from notes
const parseMultiLegBooking = (notes: string | null) => {
  if (!notes || !notes.includes('--- Multi-Leg Booking ---')) {
    return null;
  }
  
  const lines = notes.split('\n');
  const legs = [];
  
  for (const line of lines) {
    // Updated regex to handle optional date and departure time: "Leg 1: A → B (May 15) Depart: 06:00 ($100.00)"
    const legMatch = line.match(/^Leg (\d+): (.+) → (.+?)(?:\s*\(([^)]+)\))?(?:\s+Depart:\s*(\d{2}:\d{2}))?\s*\(\$(.+)\)$/);
    if (legMatch) {
      legs.push({
        legNumber: parseInt(legMatch[1]),
        origin: legMatch[2],
        destination: legMatch[3],
        rate: legMatch[6] // Rate moved to position 6
      });
    }
  }
  
  return legs.length > 0 ? legs : null;
};

export const ConfirmationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [signerName, setSignerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchConfirmation();
  }, [token]);

  const fetchConfirmation = async () => {
    try {
      setLoading(true);
      console.log('Fetching confirmation for token:', token);
      console.log('API URL:', `/bookings/confirmation/${token}`);
      const response = await api.get(`/bookings/confirmation/${token}`);
      console.log('Confirmation response:', response.data);
      setBooking(response.data.booking);
      setError(null);
    } catch (err: any) {
      console.error('Confirmation fetch error:', err);
      console.error('Error response:', err.response?.data);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to load confirmation details');
      }
      setBooking(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (approved: boolean) => {
    if (!signerName.trim()) {
      alert('Please enter your name');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/bookings/confirmation/${token}/sign`, {
        signedBy: signerName,
        approved,
        signature: approved ? 'APPROVED' : 'REJECTED'
      });
      setSubmitted(true);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit confirmation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading confirmation details...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
          <div className="text-center">
            <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p className="text-gray-600">{error || 'Confirmation not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
          <div className="text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Thank You!</h2>
            <p className="text-gray-600 mb-6">
              Your response has been recorded successfully.
            </p>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center mb-4">
            <FileText className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold">Rate Confirmation</h1>
              <p className="text-gray-600">
                Shipment #{`CCFS${booking.id.toString().padStart(5, '0')}`}
              </p>
            </div>
          </div>
        </div>

        {/* Booking Details */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Shipment Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-600">Carrier</p>
              <p className="font-medium">{booking.carrier.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date</p>
              <p className="font-medium">
                {format(new Date(booking.bookingDate), 'PPP')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Driver</p>
              <p className="font-medium">{booking.driverName || 'TBD'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-medium">{booking.phoneNumber || 'TBD'}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Route Information</h3>
            
            {(() => {
              // Parse multi-leg booking from notes
              const multiLegInfo = parseMultiLegBooking(booking.notes || null);
              
              if (multiLegInfo) {
                // Display multi-leg booking from notes
                return (
                  <>
                    {multiLegInfo.map((leg, index) => (
                      <div key={index} className="bg-gray-50 rounded p-4 mb-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="text-sm text-gray-600">Leg {leg.legNumber}</p>
                            <p className="font-medium">{leg.origin} → {leg.destination}</p>
                          </div>
                        </div>
                        <div className="flex justify-end mt-2">
                          <span className="font-semibold text-green-600">
                            ${leg.rate}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {/* Total for multi-leg */}
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total Rate</span>
                        <span className="text-lg font-bold text-green-600">
                          ${booking.rate}
                        </span>
                      </div>
                    </div>
                  </>
                );
              } else if (booking.childBookings && booking.childBookings.length > 0) {
                // Display actual child bookings (future implementation)
                return (
                  <>
                    {/* Main route */}
                    <div className="bg-gray-50 rounded p-4 mb-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">Origin</p>
                          <p className="font-medium">{booking.route.origin}</p>
                        </div>
                        <div className="mx-4 text-gray-400">→</div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">Destination</p>
                          <p className="font-medium">{booking.route.destination}</p>
                        </div>
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-sm text-gray-600">
                          Leg 1 • Distance: {booking.route.distance} miles
                        </span>
                        <span className="font-semibold text-green-600">
                          ${booking.rate}
                        </span>
                      </div>
                    </div>

                    {/* Child bookings */}
                    {booking.childBookings.map((child, index) => (
                      <div key={index} className="bg-gray-50 rounded p-4 mb-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="text-sm text-gray-600">Origin</p>
                            <p className="font-medium">{child.route.origin}</p>
                          </div>
                          <div className="mx-4 text-gray-400">→</div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-600">Destination</p>
                            <p className="font-medium">{child.route.destination}</p>
                          </div>
                        </div>
                        <div className="flex justify-between mt-2">
                          <span className="text-sm text-gray-600">
                            Leg {index + 2} • Distance: {child.route.distance} miles
                          </span>
                          <span className="font-semibold text-green-600">
                            ${child.rate}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Total for multi-leg */}
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total Rate</span>
                        <span className="text-lg font-bold text-green-600">
                          ${(parseFloat(booking.rate) + 
                             booking.childBookings.reduce((sum, child) => 
                               sum + parseFloat(child.rate), 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </>
                );
              } else {
                // Single route booking
                return (
                  <div className="bg-gray-50 rounded p-4 mb-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">Origin</p>
                        <p className="font-medium">{booking.route.origin}</p>
                      </div>
                      <div className="mx-4 text-gray-400">→</div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">Destination</p>
                        <p className="font-medium">{booking.route.destination}</p>
                      </div>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-sm text-gray-600">
                        Distance: {booking.route.distance} miles
                      </span>
                      <span className="font-semibold text-green-600">
                        ${booking.rate}
                      </span>
                    </div>
                  </div>
                );
              }
            })()}
          </div>

          {booking.type === 'POWER_AND_TRAILER' && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">Equipment Type</p>
              <p className="font-medium">
                Power and Trailer ({booking.trailerLength}' trailer)
              </p>
            </div>
          )}
        </div>

        {/* Signature Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Electronic Signature</h2>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            />
          </div>

          <p className="text-sm text-gray-600 mb-6">
            By clicking "Approve" below, you acknowledge that you have reviewed and 
            agree to the terms of this rate confirmation. Your name and IP address 
            will be recorded as your electronic signature.
          </p>

          <div className="flex gap-4">
            <button
              onClick={() => handleSubmit(true)}
              disabled={submitting || !signerName.trim()}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                submitting || !signerName.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {submitting ? (
                <Loader className="h-5 w-5 animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              Approve Rate Confirmation
            </button>
            
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting || !signerName.trim()}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                submitting || !signerName.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {submitting ? (
                <Loader className="h-5 w-5 animate-spin" />
              ) : (
                <X className="h-5 w-5" />
              )}
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};