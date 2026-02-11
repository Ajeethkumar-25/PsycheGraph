import React from 'react';
import { Navbar } from './Navbar';
import { useAuth } from '../../context/AuthContext';
import { Toaster } from 'react-hot-toast';

export const Layout = ({ children }) => {
    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1 mt-24 px-4 pb-12 w-full max-w-7xl mx-auto">
                {children}
            </main>
            <Toaster
                position="bottom-right"
                toastOptions={{
                    className: 'glass text-white border-white/10',
                    duration: 4000,
                }}
            />
        </div>
    );
};
