import React, { useRef } from 'react';
import { RateConfirmation } from './RateConfirmation';
import { RateConfirmationPage2 } from './RateConfirmationPage2';
import { Booking } from '../../types';
import { Mail, Download, Eye } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export { RateConfirmation, RateConfirmationPage2 };

interface RateConfirmationModalProps {
  booking: Booking;
  onClose: () => void;
  onEmail: (pdfBlob: Blob) => void;
}

export const RateConfirmationModal: React.FC<RateConfirmationModalProps> = ({ 
  booking, 
  onClose, 
  onEmail 
}) => {
  const confirmationRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = React.useState(false);
  
  // Generate a shipment number based on booking ID
  const shipmentNumber = `CCFS${booking.id.toString().padStart(5, '0')}`;

  const generatePDF = async (): Promise<Blob> => {
    if (!confirmationRef.current) throw new Error('Reference not found');
    
    setIsGeneratingPDF(true);
    
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter'
      });

      // Get all pages
      const pages = confirmationRef.current.querySelectorAll('.rate-confirmation, .rate-confirmation-page-2');
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        
        // Create canvas from page
        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          logging: false,
          width: page.scrollWidth,
          height: page.scrollHeight
        });
        
        const imgData = canvas.toDataURL('image/png');
        
        // Add new page for subsequent pages
        if (i > 0) {
          pdf.addPage();
        }
        
        // Add image to PDF
        pdf.addImage(imgData, 'PNG', 0, 0, 8.5, 11);
      }
      
      // Convert to blob
      const pdfBlob = pdf.output('blob');
      return pdfBlob;
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDownload = async () => {
    try {
      const pdfBlob = await generatePDF();
      
      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rate-confirmation-${shipmentNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleEmail = async () => {
    try {
      const pdfBlob = await generatePDF();
      onEmail(pdfBlob);
    } catch (error) {
      console.error('Error generating PDF for email:', error);
      alert('Failed to generate PDF for email. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-6xl my-8 mx-4">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">Rate Confirmation - {shipmentNumber}</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDownload}
              disabled={isGeneratingPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
            >
              <Download className="w-4 h-4" />
              {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
            </button>
            <button
              onClick={handleEmail}
              disabled={isGeneratingPDF || !booking.carrier?.email}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              title={!booking.carrier?.email ? 'Carrier email not available' : 'Email to carrier'}
            >
              <Mail className="w-4 h-4" />
              Email to Carrier
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-start gap-2">
              <Eye className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800 font-medium">Preview Mode</p>
                <p className="text-sm text-yellow-700">
                  This is a preview of the rate confirmation that will be sent to the carrier.
                  Click "Email to Carrier" to send it to {booking.carrier?.email || 'the carrier'}.
                </p>
              </div>
            </div>
          </div>
          
          {/* Rate Confirmation Pages */}
          <div ref={confirmationRef} className="space-y-8">
            <div className="border border-gray-300 shadow-lg">
              <RateConfirmation booking={booking} shipmentNumber={shipmentNumber} />
            </div>
            <div className="border border-gray-300 shadow-lg">
              <RateConfirmationPage2 shipmentNumber={shipmentNumber} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};