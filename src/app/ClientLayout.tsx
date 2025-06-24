'use client';

import React, { useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import Header from '../components/Header/header';
import Footer from '../components/Footer/Footer';
import ProfileGuard from '../components/ProfileGuard/ProfileGuard';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import debug utility in development
if (process.env.NODE_ENV === 'development') {
  import('../utils/authDebugger');
}

interface ClientLayoutProps {
  children: React.ReactNode;
}

const ClientLayout: React.FC<ClientLayoutProps> = ({ children }) => {
  return (
    <HelmetProvider>
      <ProfileGuard>
        <div className="layout-container bg-gradient-to-b from-black via-blue-900/20 to-black">
          <Header />
          <main style={{ flex: '1 0 auto' }}>
            {children}
          </main>
          <Footer />
        </div>
      </ProfileGuard>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </HelmetProvider>
  );
};

export default ClientLayout;