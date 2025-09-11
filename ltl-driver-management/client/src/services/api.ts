import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Email service for rate confirmations
export const sendRateConfirmationEmail = async (
  bookingId: number,
  recipientEmail: string,
  pdfBlob: Blob
): Promise<any> => {
  const formData = new FormData();
  formData.append('email', recipientEmail);
  formData.append('pdf', pdfBlob, `rate-confirmation-${bookingId}.pdf`);

  return api.post(`/bookings/${bookingId}/rate-confirmation/send`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};