import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  LayoutGrid,
  QrCode,
  Printer,
  FileText
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Quick Navigation Cards
  const quickNavCards = [
    {
      name: 'LineHaul Dispatch',
      icon: LayoutGrid,
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600',
      route: '/dispatch'
    },
    {
      name: 'Dispatch Trip',
      icon: Truck,
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600',
      route: '/dispatch/trip'
    },
    {
      name: 'Arrive Trip',
      icon: Truck,
      color: 'bg-orange-500',
      hoverColor: 'hover:bg-orange-600',
      route: '/arrive-trip'
    },
    {
      name: 'Transfer Scans',
      icon: QrCode,
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600',
      route: '/transfer-scans'
    },
    {
      name: 'Print Hazmat BOL',
      icon: Printer,
      color: 'bg-red-500',
      hoverColor: 'hover:bg-red-600',
      route: '/print-hazmat-bol'
    },
    {
      name: 'Create Loadsheets',
      icon: FileText,
      color: 'bg-teal-500',
      hoverColor: 'hover:bg-teal-600',
      route: '/loadsheets/new'
    }
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">CrossCountry Freight Solutions</h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">
          LTL Carrier Network Management Platform
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Operational overview and key performance indicators
        </p>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {quickNavCards.map((card) => (
          <button
            key={card.name}
            onClick={() => navigate(card.route)}
            className={`${card.color} ${card.hoverColor} p-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 flex flex-col items-center justify-center text-white`}
          >
            <card.icon className="h-10 w-10 mb-3" />
            <span className="text-sm font-semibold text-center">{card.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};