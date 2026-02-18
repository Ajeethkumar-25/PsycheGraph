import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { logout, clearSuccessMessage } from '../store/slices/AllLoginSlice';
import {
    LayoutDashboard,
    Users,
    LogOut,
    BrainCircuit,
    FileAudio,
    Building2,
    Settings,
    Calendar,
    Search,
    Bell,
    ChevronRight,
    Sparkles,
    CheckCircle2,
    Menu,
    X
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useState, useEffect, useRef } from 'react';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function Layout() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef(null);

    const { user, successMessage } = useSelector((state) => state.auth);

    useEffect(() => {
        function handleClickOutside(event) {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [profileRef]);

    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => {
                dispatch(clearSuccessMessage());
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, dispatch]);

    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

    useEffect(() => {
        const handleResize = () => {
            const isLg = window.innerWidth >= 1024;
            setIsDesktop(isLg);
            if (isLg) setIsSidebarOpen(false); // Close mobile sidebar when resizing to desktop
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleLogout = () => {
        dispatch(logout());
        navigate('/admin');
    };

    let navItems = [];

    const getRoleConfig = (role) => {
        switch (role) {
            case 'SUPER_ADMIN':
                return {
                    label: 'Super Admin',
                    color: 'from-purple-500 to-pink-500',
                    bg: 'bg-purple-50',
                    text: 'text-purple-600'
                };
            case 'ADMIN':
            case 'HOSPITAL':
                return {
                    label: 'Admin',
                    color: 'from-blue-500 to-cyan-500',
                    bg: 'bg-blue-50',
                    text: 'text-blue-600'
                };
            case 'RECEPTIONIST':
                return {
                    label: 'Receptionist',
                    color: 'from-indigo-500 to-indigo-600',
                    bg: 'bg-indigo-50',
                    text: 'text-indigo-600'
                };
            default:
                return {
                    label: 'Doctor',
                    color: 'from-emerald-500 to-teal-500',
                    bg: 'bg-emerald-50',
                    text: 'text-emerald-600'
                };
        }
    };

    const userRole = (user?.role || user?.user?.role)?.toUpperCase();
    const roleConfig = getRoleConfig(userRole);

    if (userRole === 'SUPER_ADMIN') {
        navItems = [
            { name: 'Platform Admin', path: '/superadmin', icon: LayoutDashboard },
            { name: 'Organizations', path: '/superadmin/organizations', icon: Building2 },
            { name: 'Hospital Details', path: '/superadmin/hospitals', icon: Users },
        ];
    } else if (userRole === 'ADMIN' || userRole === 'HOSPITAL') {
        navItems = [
            { name: 'Dashboard', path: '/hospital-admin', icon: LayoutDashboard },
            { name: 'Staff Management', path: '/hospital-admin/users', icon: Users },
        ];
    } else if (userRole === 'RECEPTIONIST') {
        navItems = [
            { name: 'Dashboard', path: '/receptionist', icon: LayoutDashboard },
            { name: 'Patients', path: '/receptionist/patients', icon: Users },
            { name: 'Appointments', path: '/receptionist/appointments', icon: Calendar },
        ];
    } else {
        // Doctor
        navItems = [
            { name: 'Dashboard', path: '/', icon: LayoutDashboard },
            { name: 'Patients', path: '/patients', icon: Users },
            { name: 'Sessions', path: '/sessions', icon: FileAudio },
        ];
    }

    return (
        <div className="flex h-screen bg-[#062f3f] relative overflow-hidden">
            {/* Success Toast Notification */}
            <AnimatePresence>
                {successMessage && (
                    <motion.div 
                        initial={{ opacity: 0, x: -20, y: 20 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed top-6 lg:top-8 left-6 lg:left-8 z-[100] p-4 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-2xl flex items-center gap-3 shadow-2xl shadow-emerald-500/10 backdrop-blur-md"
                    >
                        <div className="h-8 w-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <CheckCircle2 size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] leading-none mb-1">System Message</p>
                            <p className="text-sm font-black text-white uppercase tracking-tight">{successMessage}</p>
                        </div>
                        <button
                            onClick={() => dispatch(clearSuccessMessage())}
                            className="ml-4 p-1 hover:bg-emerald-500/10 rounded-lg transition-colors text-emerald-400"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                )} 
            </AnimatePresence>

            {/* Mobile Overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
                    />
                )}
            </AnimatePresence>
            {/* Animated Background Orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"
                />
                <motion.div
                    animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0] }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"
                />
            </div>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{
                    x: isDesktop ? 0 : (isSidebarOpen ? 0 : '-100%')
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-72 fixed lg:relative inset-y-0 left-0 z-50 bg-[#062f3f] border-r border-white/5 flex flex-col shadow-2xl"
            >
                {/* Logo Section */}
                <div className="p-6 pb-4 flex items-center justify-between gap-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <motion.div
                            whileHover={{ scale: 1.05, rotate: 5 }}
                            className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2 rounded-xl text-white shadow-lg shadow-cyan-500/30"
                        >
                            <BrainCircuit size={24} />
                        </motion.div>
                        <div>
                            <span className="text-xl font-black text-white tracking-tight block leading-none">PsycheGraph</span>
                            <span className="text-[9px] font-semibold text-cyan-400 uppercase tracking-wider mt-0.5 block opacity-80">Healthcare Platform</span>
                        </div>
                    </div>
                    {/* Close button for mobile */}
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <X size={18} className="text-white/60" />
                    </button>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
                    <p className="px-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">Navigation</p>
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => !isDesktop && setIsSidebarOpen(false)}
                                className="relative group block"
                            >
                                <motion.div
                                    whileHover={{ x: 4 }}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative overflow-hidden",
                                        isActive
                                            ? "text-white bg-white/10"
                                            : "text-white/60 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    <div className={cn(
                                        "relative z-10 transition-all",
                                        isActive && "text-cyan-400"
                                    )}>
                                        <item.icon size={18} strokeWidth={2.5} />
                                    </div>
                                    <span className="relative z-10 font-bold text-sm tracking-tight">{item.name}</span>
                                    {isActive && (
                                        <motion.div
                                            layoutId="nav-indicator"
                                            className="absolute right-2 w-1 h-1 rounded-full bg-cyan-400 z-10"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                </motion.div>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 mt-auto">
                    <div className="flex items-center justify-center gap-2 text-[9px] font-bold text-white/20">
                        <Sparkles size={10} className="text-cyan-500 opacity-50" />
                        <span>V 2.0.4 PREMIUM</span>
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 relative z-10 overflow-auto custom-scrollbar lg:ml-0 bg-slate-50">
                {/* Elegant Top Header - Dark Theme Match */}
                <header className="sticky top-0 h-16 lg:h-20 backdrop-blur-xl bg-[#062f3f] border-b border-white/5 flex items-center justify-between px-4 lg:px-10 z-30 shadow-md">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="lg:hidden p-2 hover:bg-white/5 rounded-xl transition-colors"
                    >
                        <Menu size={24} className="text-white/80" />
                    </button>
                    <div className="flex items-center gap-4 lg:gap-6">
                        <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-widest">
                            <span>Platform</span>
                            <ChevronRight size={14} />
                            <span className="text-cyan-400 font-black">{navItems.find(i => i.path === location.pathname)?.name || 'Home'}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 lg:gap-4">


                        <div className="hidden sm:block h-10 w-px bg-slate-200 mx-2" />

                        {/* Profile Dropdown */}
                        <div className="relative" ref={profileRef}>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-2 lg:gap-3 pl-1 pr-2 lg:pr-3 py-1 bg-white/5 hover:bg-white/10 rounded-xl lg:rounded-2xl shadow-lg border border-white/5 overflow-hidden cursor-pointer backdrop-blur-md transition-all"
                            >
                                <div className={cn(
                                    "h-7 w-7 lg:h-8 lg:w-8 rounded-lg lg:rounded-xl flex items-center justify-center text-white text-xs lg:text-sm font-bold bg-gradient-to-br",
                                    roleConfig.color
                                )}>
                                    {/* First letter of Name or Sub */}
                                    {(user?.full_name?.[0] || user?.sub?.[0] || 'U')?.toUpperCase()}
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-[11px] font-black text-white leading-none">{user?.full_name || user?.sub}</p>
                                    <p className="text-[10px] font-bold text-white/40 mt-1 uppercase tracking-tighter">{roleConfig.label}</p>
                                </div>
                            </motion.button>

                            <AnimatePresence>
                                {isProfileOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 p-2"
                                    >
                                        <div className="px-3 py-2 border-b border-slate-100 mb-2">
                                            <p className="text-sm font-bold text-slate-900">{user?.full_name || user?.sub}</p>
                                            <p className="text-xs text-slate-500">{user?.sub}</p>
                                        </div>
                                        <button className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                                            <Settings size={16} />
                                            <span>Settings</span>
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <LogOut size={16} />
                                            <span>Logout</span>
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                <div className="p-4 lg:p-10">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
