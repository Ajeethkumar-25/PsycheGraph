import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User, Activity, Calendar, FileText, Menu, X, Shield } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const Navbar = () => {
    const { user, logout, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);

    const navItems = [
        { name: 'Dashboard', icon: Activity, path: '/' },
        { name: 'Appointments', icon: Calendar, path: '/appointments' },
        { name: 'Patients', icon: User, path: '/patients' },
        { name: 'Sessions', icon: FileText, path: '/sessions' },
        { name: 'Management', icon: Shield, path: '/management', roles: ['SUPER_ADMIN', 'HOSPITAL'] },
        { name: 'Settings', icon: User, path: '/settings' },
    ];

    const filteredItems = navItems.filter(item =>
        !item.roles || item.roles.includes(user?.role)
    );

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 px-4 pt-4">
            <div className="max-w-7xl mx-auto glass rounded-2xl px-6 py-3 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2 group">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:rotate-6 transition-transform">
                        <Activity size={24} />
                    </div>
                    <span className="text-xl font-display font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        PsycheGraph
                    </span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-8">
                    {isAuthenticated && (
                        <>
                            {filteredItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                                >
                                    <item.icon size={18} />
                                    {item.name}
                                </Link>
                            ))}
                            <div className="h-6 w-px bg-white/10 mx-2" />
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-end">
                                    <span className="text-sm font-medium text-white">{user?.full_name}</span>
                                    <span className="text-[10px] uppercase tracking-wider text-primary-400">{user?.role}</span>
                                </div>
                                <button
                                    onClick={logout}
                                    className="p-2.5 rounded-xl bg-white/5 hover:bg-accent-500/10 hover:text-accent-500 transition-all"
                                >
                                    <LogOut size={20} />
                                </button>
                            </div>
                        </>
                    )}
                    {!isAuthenticated && (
                        <Link to="/login" className="btn-primary py-2 px-8">
                            Sign In
                        </Link>
                    )}
                </div>

                {/* Mobile Toggle */}
                <button className="md:hidden text-white" onClick={() => setIsOpen(!isOpen)}>
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Drawer */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="md:hidden mt-2 glass rounded-2xl p-4 flex flex-col gap-2"
                    >
                        {isAuthenticated ? (
                            <>
                                {filteredItems.map((item) => (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={() => setIsOpen(false)}
                                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white"
                                    >
                                        <item.icon size={20} />
                                        {item.name}
                                    </Link>
                                ))}
                                <button
                                    onClick={() => {
                                        logout();
                                        setIsOpen(false);
                                    }}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent-500/10 text-accent-500 mt-2"
                                >
                                    <LogOut size={20} />
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <Link to="/login" onClick={() => setIsOpen(false)} className="btn-primary text-center">
                                Sign In
                            </Link>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};
