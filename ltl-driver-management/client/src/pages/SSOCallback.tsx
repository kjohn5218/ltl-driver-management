import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, Loader2 } from 'lucide-react';

export const SSOCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleSSOCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');

    if (token && userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam));
        handleSSOCallback(token, user);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('Failed to parse SSO callback data:', err);
        setError('Failed to process SSO login. Please try again.');
      }
    } else {
      setError('Invalid SSO callback parameters. Please try again.');
    }
  }, [searchParams, handleSSOCallback, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="flex justify-center">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <p className="mt-2 text-sm text-red-800">{error}</p>
          </div>
          <a
            href="/login"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Return to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
        <p className="mt-4 text-gray-600">Completing sign-in...</p>
      </div>
    </div>
  );
};
