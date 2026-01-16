import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Menu, LogOut, Building2, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CompanyProfileModal } from '../CompanyProfileModal';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const [isCompanyProfileOpen, setIsCompanyProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="bg-blue-600 dark:bg-blue-700 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
          <div className="flex items-center">
            <button
              onClick={onMenuClick}
              className="p-2 rounded-md text-white/80 hover:text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-white/50 lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="flex items-center ml-2">
              <img src="/ccfs-logo-white.svg" alt="CCFS Logo" className="h-8 mr-3" />
              <h1 className="text-xl font-semibold text-white hidden sm:block">
                Linehaul Management
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsCompanyProfileOpen(true)}
              className="hidden md:inline-flex items-center px-3 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-blue-500 rounded-md transition-colors"
              title="Company Profile"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Company Profile
            </button>

            <div className="flex items-center text-sm text-white">
              <span className="font-medium">{user?.name}</span>
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-white/80 hover:text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <button
              onClick={handleLogout}
              className="p-2 rounded-md text-white/80 hover:text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          </div>
        </div>
      </header>
      
      <CompanyProfileModal
        isOpen={isCompanyProfileOpen}
        onClose={() => setIsCompanyProfileOpen(false)}
      />
    </>
  );
};