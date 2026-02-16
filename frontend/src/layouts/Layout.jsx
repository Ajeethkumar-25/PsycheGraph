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
                    color: 'from-orange-500 to-amber-500',
                    bg: 'bg-orange-50',
                    text: 'text-orange-600'
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
        <div className="flex h-screen bg-slate-50/50 relative overflow-hidden">
            {/* Success Toast Notification */}
            <AnimatePresence>
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, x: -20, y: 20 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed top-6 lg:top-8 left-6 lg:left-8 z-[100] p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex items-center gap-3 shadow-2xl shadow-emerald-500/20 backdrop-blur-md"
                    >
                        <div className="h-8 w-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <CheckCircle2 size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] leading-none mb-1">System Message</p>
                            <p className="text-sm font-black text-emerald-900 uppercase tracking-tight">{successMessage}</p>
                        </div>
                        <button
                            onClick={() => dispatch(clearSuccessMessage())}
                            className="ml-4 p-1 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-400"
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
                        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    />
                )}
            </AnimatePresence>
            {/* Animated Background Orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-40 -left-40 w-80 h-80 bg-primary-400/5 rounded-full blur-3xl"
                />
                <motion.div
                    animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0] }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-40 -right-40 w-80 h-80 bg-purple-400/5 rounded-full blur-3xl"
                />
            </div>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{
                    x: isDesktop ? 0 : (isSidebarOpen ? 0 : '-100%')
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-72 fixed lg:relative inset-y-0 left-0 z-50 backdrop-blur-xl bg-white/80 border-r border-white/50 flex flex-col shadow-[rgba(0,0,15,0.05)_10px_0px_20px_-5px]"
            >
                {/* Logo Section */}
                <div className="p-6 lg:p-8 pb-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <motion.div
                            whileHover={{ scale: 1.05, rotate: 5 }}
                            className="bg-gradient-to-br from-primary-600 to-primary-700 p-2.5 rounded-xl text-white shadow-lg shadow-primary-500/30"
                        >
                            <BrainCircuit size={28} />
                        </motion.div>
                        <div>
                            <span className="text-2xl font-black text-slate-900 tracking-tight block leading-none">PsycheGraph</span>
                            <span className="text-[10px] font-bold text-primary-600 uppercase tracking-[0.2em] mt-1 block">Enterprise docs</span>
                        </div>
                    </div>
                    {/* Close button for mobile */}
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Search Bar - Aesthetic addition */}
                {/* <div className="px-6 mb-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Quick find..."
                            className="w-full bg-slate-100/50 border-none rounded-xl py-2 pl-10 pr-4 text-xs font-medium focus:ring-2 focus:ring-primary-500/20 outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div> */}

                <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar">
                    <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Main Menu</p>
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
                                    whileHover={{ x: 5 }}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all relative overflow-hidden",
                                        isActive
                                            ? "text-primary-600"
                                            : "text-slate-500 hover:text-slate-900"
                                    )}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="nav-active"
                                            className="absolute inset-0 bg-primary-50 rounded-2xl z-0"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <div className={cn(
                                        "relative z-10 transition-transform duration-300 group-hover:scale-110",
                                        isActive && "text-primary-600"
                                    )}>
                                        <item.icon size={20} />
                                    </div>
                                    <span className="relative z-10 font-bold text-sm tracking-tight">{item.name}</span>
                                    {isActive && (
                                        <motion.div
                                            layoutId="nav-pill"
                                            className="absolute right-3 w-1.5 h-1.5 rounded-full bg-primary-500 z-10"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                </motion.div>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 mt-auto">
                    {/* User Profile Card Removed */}

                    <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400">
                        <Sparkles size={10} className="text-primary-400" />
                        <span>V 2.0.4 PREMIUM</span>
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 relative z-10 overflow-auto custom-scrollbar lg:ml-0">
                {/* Elegant Top Header */}
                <header className="sticky top-0 h-16 lg:h-20 backdrop-blur-md bg-white/60 border-b border-white/50 flex items-center justify-between px-4 lg:px-10 z-30 shadow-sm">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="lg:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <Menu size={24} className="text-slate-700" />
                    </button>
                    <div className="flex items-center gap-4 lg:gap-6">
                        <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <span>Platform</span>
                            <ChevronRight size={14} />
                            <span className="text-primary-600">{navItems.find(i => i.path === location.pathname)?.name || 'Home'}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 lg:gap-4">
                        

                        <div className="hidden sm:block h-10 w-px bg-slate-200 mx-2" />

                        {/* Profile Dropdown */}
                        <div className="relative" ref={profileRef}>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-2 lg:gap-3 pl-1 pr-2 lg:pr-3 py-1 bg-white rounded-xl lg:rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer"
                            >
                                <div className={cn(
                                    "h-7 w-7 lg:h-8 lg:w-8 rounded-lg lg:rounded-xl flex items-center justify-center text-white text-xs lg:text-sm font-bold bg-gradient-to-br",
                                    roleConfig.color
                                )}>
                                    {/* First letter of Name or Sub */}
                                    {(user?.full_name?.[0] || user?.sub?.[0] || 'U')?.toUpperCase()}
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-[11px] font-black text-slate-900 leading-none">{user?.full_name || user?.sub}</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{roleConfig.label}</p>
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
