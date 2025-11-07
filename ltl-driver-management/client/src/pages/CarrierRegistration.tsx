import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { Upload, CheckCircle, AlertCircle, FileText, Truck } from 'lucide-react';

export const CarrierRegistration: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    contactPersonTitle: '',
    phone: '',
    email: '',
    mcNumber: '',
    dotNumber: '',
    streetAddress1: '',
    streetAddress2: '',
    city: '',
    state: '',
    zipCode: '',
    safetyRating: '',
    taxId: '',
    ratePerMile: '',
    rating: '',
    remittanceContact: '',
    remittanceEmail: '',
    factoringCompany: '',
    insuranceExpiration: ''
  });
  
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [existingCarrierWarning, setExistingCarrierWarning] = useState<string | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  // Validate token on component mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenValid(false);
        return;
      }
      
      try {
        const response = await api.get(`/carriers/validate-invitation/${encodeURIComponent(token)}`);
        setTokenValid(true);
        if (response.data.existingCarrier) {
          setExistingCarrierWarning(response.data.warning || 'A carrier with this email already exists. Continuing will update their information.');
        }
      } catch (error) {
        setTokenValid(false);
      }
    };
    
    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    
    // Client-side validation
    const validationErrors: string[] = [];
    
    if (!formData.name.trim()) {
      validationErrors.push('Carrier name is required');
    }
    
    if (!formData.contactPerson.trim()) {
      validationErrors.push('Contact Person is required');
    }
    
    if (!formData.contactPersonTitle.trim()) {
      validationErrors.push('Contact Person Title is required');
    }
    
    if (!formData.phone.trim()) {
      validationErrors.push('Phone is required');
    }
    
    if (!formData.email.trim()) {
      validationErrors.push('Email is required');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      validationErrors.push('Please enter a valid email address');
    }
    
    if (!formData.streetAddress1.trim()) {
      validationErrors.push('Street Address 1 is required');
    }
    
    if (!formData.city.trim()) {
      validationErrors.push('City is required');
    }
    
    if (!formData.state.trim()) {
      validationErrors.push('State is required');
    }
    
    if (!formData.zipCode.trim()) {
      validationErrors.push('Zip Code is required');
    }
    
    if (!formData.mcNumber.trim()) {
      validationErrors.push('MC Number is required');
    }
    
    if (!formData.dotNumber.trim()) {
      validationErrors.push('DOT Number is required');
    }
    
    if (!agreementAccepted) {
      validationErrors.push('You must accept the Carrier Agreement to proceed');
    }
    
    if (!insuranceFile) {
      validationErrors.push('Insurance document is required');
    }
    
    if (formData.ratePerMile && (isNaN(parseFloat(formData.ratePerMile)) || parseFloat(formData.ratePerMile) < 0)) {
      validationErrors.push('Rate per mile must be a valid positive number');
    }
    
    if (formData.rating && (isNaN(parseFloat(formData.rating)) || parseFloat(formData.rating) < 0 || parseFloat(formData.rating) > 5)) {
      validationErrors.push('Rating must be a number between 0 and 5');
    }
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Create FormData for file upload
      const submitData = new FormData();
      
      // Append all form fields (including empty strings as they might be checked on server)
      Object.entries(formData).forEach(([key, value]) => {
        submitData.append(key, value || '');
      });
      
      // Debug: Log what we're sending
      console.log('Form data being sent:');
      for (const [key, value] of submitData.entries()) {
        console.log(`${key}:`, value);
      }
      
      // Append the insurance file
      if (insuranceFile) {
        submitData.append('insuranceDocument', insuranceFile);
      }
      
      // Append the token
      submitData.append('token', token || '');
      
      await api.post('/carriers/register', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setIsSubmitted(true);
    } catch (error: any) {
      console.error('Error submitting registration:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Token being sent:', token);
      
      // Extract validation errors from server response
      let errorMessages = ['Failed to submit registration. Please try again.'];
      
      if (error.response?.data?.message) {
        errorMessages = [error.response.data.message];
      } else if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        errorMessages = error.response.data.errors.map((err: any) => 
          `${err.path || err.param}: ${err.msg}`
        );
      }
      
      setErrors(errorMessages);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (PDF, DOC, DOCX, JPG, PNG)
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        setErrors(['Please upload a PDF, DOC, DOCX, JPG, or PNG file']);
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setErrors(['File size must be less than 10MB']);
        return;
      }
      
      setInsuranceFile(file);
      setErrors([]);
    }
  };

  // Loading state while validating token
  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Invalid token or missing token
  if (tokenValid === false || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {!token ? 'Missing Registration Token' : 'Invalid Invitation'}
          </h1>
          <p className="text-gray-600 mb-6">
            {!token 
              ? 'This page requires a valid registration token. Please use the link from your invitation email.'
              : 'This invitation link is invalid or has expired.'
            } Please contact CrossCountry Freight Solutions at (800) 521-0287 for assistance.
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Registration Submitted!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for registering with CrossCountry Freight Solutions. Your information has been 
            submitted and our team will review your application. You will be contacted once your 
            carrier profile has been approved.
          </p>
          <div className="bg-blue-50 p-4 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Next Steps:</strong><br />
              • Our team will review your information<br />
              • You'll receive a confirmation email<br />
              • Account setup will be completed within 1-2 business days
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-4">
            <Truck className="w-12 h-12 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">CrossCountry Freight Solutions</h1>
          </div>
          <h2 className="text-xl text-gray-600">Carrier Registration</h2>
          <p className="text-gray-500 mt-2">Complete your carrier profile to join our network</p>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-8">
          {/* Warning Display for Existing Carrier */}
          {existingCarrierWarning && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">Note</h3>
                  <p className="text-sm text-yellow-700 mt-1">{existingCarrierWarning}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Error Display */}
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <AlertCircle className="w-5 h-5 text-red-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">
                    Please correct the following errors:
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="list-disc pl-5 space-y-1">
                      {errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="contactPerson"
                    required
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="contactPersonTitle"
                    required
                    placeholder="e.g., Officer, CEO, Manager"
                    value={formData.contactPersonTitle}
                    onChange={(e) => setFormData({ ...formData, contactPersonTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Address Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address 1 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="streetAddress1"
                    required
                    value={formData.streetAddress1}
                    onChange={(e) => setFormData({ ...formData, streetAddress1: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address 2</label>
                  <input
                    type="text"
                    value={formData.streetAddress2}
                    onChange={(e) => setFormData({ ...formData, streetAddress2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="city"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="state"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="zipCode"
                    required
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Regulatory Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Regulatory Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MC Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="mcNumber"
                    required
                    value={formData.mcNumber}
                    onChange={(e) => setFormData({ ...formData, mcNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DOT Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="dotNumber"
                    required
                    value={formData.dotNumber}
                    onChange={(e) => setFormData({ ...formData, dotNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Safety Rating</label>
                  <select
                    value={formData.safetyRating}
                    onChange={(e) => setFormData({ ...formData, safetyRating: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Rating</option>
                    <option value="Acceptable">Acceptable</option>
                    <option value="Conditional">Conditional</option>
                    <option value="Unacceptable">Unacceptable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Expiration</label>
                  <input
                    type="date"
                    value={formData.insuranceExpiration}
                    onChange={(e) => setFormData({ ...formData, insuranceExpiration: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Financial Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate per Mile</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.ratePerMile}
                    onChange={(e) => setFormData({ ...formData, ratePerMile: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                  <input
                    type="text"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Factoring Company</label>
                  <input
                    type="text"
                    value={formData.factoringCompany}
                    onChange={(e) => setFormData({ ...formData, factoringCompany: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Remittance Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Remittance Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remittance Contact</label>
                  <input
                    type="text"
                    value={formData.remittanceContact}
                    onChange={(e) => setFormData({ ...formData, remittanceContact: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remittance Email</label>
                  <input
                    type="email"
                    value={formData.remittanceEmail}
                    onChange={(e) => setFormData({ ...formData, remittanceEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Insurance Document Upload */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Insurance Documentation</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <div className="mb-4">
                  <label htmlFor="insurance-file" className="cursor-pointer">
                    <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                      Upload Insurance Certificate <span className="text-red-500">*</span>
                    </span>
                    <input
                      id="insurance-file"
                      name="insuranceDocument"
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      required
                    />
                  </label>
                </div>
                {insuranceFile ? (
                  <div className="flex items-center justify-center space-x-2 text-sm text-green-600">
                    <FileText className="w-4 h-4" />
                    <span>{insuranceFile.name}</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    Supported formats: PDF, DOC, DOCX, JPG, PNG (max 10MB)
                  </p>
                )}
              </div>
            </div>

            {/* Agreement Acceptance */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Carrier Agreement</h3>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  By registering as a carrier with CrossCountry Freight Solutions, Inc., you agree to our terms and conditions.
                </p>
                <div className="flex items-center">
                  <a 
                    href="/CCFS_CarrierBroker_Agreement.docx" 
                    download="CrossCountry_Carrier_Agreement.docx"
                    className="text-blue-600 hover:text-blue-700 underline text-sm font-medium"
                  >
                    Download Carrier Agreement (DOCX)
                  </a>
                </div>
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="agreement-acceptance"
                    name="agreementAccepted"
                    checked={agreementAccepted}
                    onChange={(e) => setAgreementAccepted(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    required
                  />
                  <label htmlFor="agreement-acceptance" className="ml-2 text-sm text-gray-700">
                    <span className="font-medium">I certify under penalty of perjury under the laws of the United States of America that:</span>
                    <ul className="mt-2 ml-4 list-disc space-y-1 text-gray-600">
                      <li>I have read and agree to the Carrier Agreement terms and conditions</li>
                      <li>I have authorization by {formData.name || '[Carrier Name]'} to sign agreements on their behalf</li>
                      <li>I understand that this electronic signature constitutes a legally binding agreement</li>
                    </ul>
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6 border-t">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center px-6 py-3 bg-blue-600 text-white text-lg font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Submitting Registration...
                  </>
                ) : (
                  'Submit Registration'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>
            Need help? Contact us at{' '}
            <a href="tel:+18005210287" className="text-blue-600 hover:text-blue-500">
              (800) 521-0287
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};