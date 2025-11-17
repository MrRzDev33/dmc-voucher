
import React, { useState, useRef, useEffect } from 'react';
import ClaimPage from './pages/ClaimPage';
import AdminPage from './pages/AdminPage';
import { VoucherProvider } from './context/VoucherContext';
import { AuthProvider } from './context/AuthContext';

type Page = 'claim' | 'admin';

const HamburgerIcon: React.FC = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
);

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('claim');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleNavClick = (page: Page) => {
    setCurrentPage(page);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <AuthProvider>
      <VoucherProvider>
        <div className="min-h-screen bg-gray-50 text-gray-800">
          <header className="bg-white shadow-md sticky top-0 z-20">
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex-shrink-0">
                  <span className="text-2xl font-bold text-primary">DMC Voucher</span>
                </div>
                
                {/* Desktop Menu */}
                <div className="hidden sm:flex items-center space-x-4">
                  <button
                    onClick={() => handleNavClick('claim')}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      currentPage === 'claim'
                        ? 'bg-orange-100 text-primary'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Claim Voucher
                  </button>
                  <button
                    onClick={() => handleNavClick('admin')}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      currentPage === 'admin'
                        ? 'bg-orange-100 text-primary'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Admin Panel
                  </button>
                </div>

                {/* Mobile Menu Button & Overlay */}
                <div className="sm:hidden" ref={menuRef}>
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                    aria-label="Open menu"
                  >
                    <HamburgerIcon />
                  </button>
                  
                  {isMenuOpen && (
                    <div className="absolute top-16 right-4 mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5">
                      <button
                        onClick={() => handleNavClick('claim')}
                        className={`block w-full text-left px-4 py-2 text-sm ${
                          currentPage === 'claim' ? 'bg-orange-100 text-primary' : 'text-gray-700'
                        } hover:bg-gray-100`}
                      >
                        Claim Voucher
                      </button>
                      <button
                        onClick={() => handleNavClick('admin')}
                        className={`block w-full text-left px-4 py-2 text-sm ${
                           currentPage === 'admin' ? 'bg-orange-100 text-primary' : 'text-gray-700'
                        } hover:bg-gray-100`}
                      >
                        Admin Panel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </nav>
          </header>

          <main>
            {currentPage === 'claim' && <ClaimPage />}
            {currentPage === 'admin' && <AdminPage />}
          </main>
          
          <footer className="bg-white mt-12 py-4 text-center text-gray-500 text-sm">
              <p>&copy; {new Date().getFullYear()} DMC Corporation. All rights reserved.</p>
          </footer>
        </div>
      </VoucherProvider>
    </AuthProvider>
  );
};

export default App;
