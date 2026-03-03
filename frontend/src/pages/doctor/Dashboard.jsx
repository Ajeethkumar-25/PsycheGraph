import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    Users,
    Activity,
    PlayCircle,
    Clock,
    ChevronRight,
    Stethoscope,
    FileText,
    ArrowRight,
    TrendingUp,
    Sparkles,
    Shield,
    Bell,
    History,
    Search,
    UserCheck,
    Briefcase,
    Video
} from 'lucide-react';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

export default function DoctorDashboard() {
    const dispatch = useDispatch();
    const { list: appointments, loading: appLoading } = useSelector((state) => state.appointments);
    const { list: patients, loading: patLoading } = useSelector((state) => state.patients);
    const { user } = useSelector((state) => state.auth);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        dispatch(fetchAppointments());
        dispatch(fetchPatients());
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [dispatch]);

    const todayString = new Date().toISOString().split('T')[0];
    const todaysAppointments = appointments
        .filter(app => app.start_time?.startsWith(todayString))
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const nextPatient = todaysAppointments.find(app => app.status === 'SCHEDULED' && new Date(app.start_time) > new Date());
    const ongoingSession = todaysAppointments.find(app => app.status === 'ONGOING');

    const filteredAppointments = todaysAppointments.filter(app =>
        app.patient_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Debugging user object
    useEffect(() => {
        console.log('DoctorDashboard User Object:', user);
    }, [user]);

    if (appLoading || patLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="relative">
                    <motion.div
                        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="text-primary-500"
                    >
                        <Activity size={60} strokeWidth={1} />
                    </motion.div>
                    <motion.div
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 flex items-center justify-center text-xs font-black text-primary-600 uppercase tracking-widest"
                    >
                        syncing
                    </motion.div>
                </div>
            </div>
        );
    }

    const stats = [
        {
            label: 'Active Patients',
            value: patients.length,
            icon: Users,
            color: 'from-indigo-600 to-blue-500',
            glow: 'shadow-blue-500/20',
            trend: '+2 this month',
            subLabel: 'Total active cases'
        },
        {
            label: 'Sessions This Week',
            value: '12', // Mocked value for now
            icon: Video,
            color: 'from-violet-600 to-purple-500',
            glow: 'shadow-purple-500/20',
            trend: '3 remaining',
            subLabel: 'Weekly load'
        },
        {
            label: 'Pending Notes',
            value: '5', // Mocked value
            icon: FileText,
            color: 'from-amber-500 to-orange-500',
            glow: 'shadow-orange-500/20',
            trend: 'Due today: 2',
            subLabel: 'Action required'
        },
        {
            label: 'Upcoming Appointments',
            value: todaysAppointments.length,
            icon: Calendar,
            color: 'from-emerald-600 to-teal-500',
            glow: 'shadow-emerald-500/20',
            trend: 'Next: 2:00 PM',
            subLabel: 'View schedule'
        },
    ];

    
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    };


    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-[1400px] mx-auto space-y-6 pb-20 px-4 pt-4"
        >
            {/* Ultra-Modern Header */}
            <motion.div variants={itemVariants} className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="space-y-2">
                    <h1
                        className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight"
                        data-debug-user={JSON.stringify(user || 'no-user')}
                    >
                        {getGreeting()}, <span className="text-slate-800 bg-clip-text text-transparent bg-slate-900 animate-gradient-x  decoration-primary-100 decoration-4 underline-offset-4">
                            Dr. {(
                                user?.full_name || 'Clinician'
                            ).toString().replace(/^(dr\.?\s*)/i, '')}
                        </span>
                    </h1>
                    <p className="text-slate-500 font-medium text-lg flex items-center gap-3">
                        <Shield size={20} className="text-primary-500" />
                        Your clinical dashboard is synced and secured.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end px-6 py-3 bg-white rounded-3xl border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Local Time</span>
                        <span className="text-xl font-black text-slate-800 tabular-nums">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>

                </div>
            </motion.div>

            {/* Stats Visualization */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={stat.label}
                            whileHover={{ y: -8, scale: 1.01 }}
                            className="relative group cursor-default"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative bg-white p-5 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                                <div className={cn("absolute -right-8 -top-8 w-24 h-24 bg-gradient-to-br opacity-5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700", stat.color)} />

                                <div className="flex items-start justify-between mb-4">
                                    <div className={cn("p-3 rounded-xl shadow-xl text-white bg-gradient-to-br", stat.color, stat.glow)}>
                                        <Icon size={22} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                                            <TrendingUp size={10} />
                                            {stat.trend}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{stat.value}</h3>
                                        <span className="text-[10px] font-bold text-slate-400">{stat.subLabel}</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>

            {/* Core Action Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                {/* Session Control Center */}
                <motion.div variants={itemVariants} className="xl:col-span-8 group">
                    <div className="relative h-full overflow-hidden rounded-[3rem] shadow-2xl bg-slate-900 shadow-primary-900/10">
                        {/* Dynamic Background */}
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                x: [0, 50, 0],
                                y: [0, -30, 0]
                            }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className="absolute -right-20 -top-20 w-[600px] h-[600px] bg-primary-600/30 rounded-full blur-[120px] pointer-events-none"
                        />
                        <motion.div
                            animate={{
                                scale: [1.2, 1, 1.2],
                                x: [0, -50, 0],
                                y: [0, 30, 0]
                            }}
                            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                            className="absolute -left-20 -bottom-20 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none"
                        />

                        <div className="relative z-10 p-12 h-full flex flex-col">
                            {ongoingSession || nextPatient ? (
                                <div className="flex-1 flex flex-col justify-between space-y-12">
                                    <div className="flex items-center justify-between">
                                        <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/10 text-white">
                                            <div className="relative flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-[0.2em]">
                                                {ongoingSession ? 'In Progress' : 'Upcoming Session'}
                                            </span>
                                        </div>
                                        <button className="text-white/40 hover:text-white transition-colors">
                                            <History size={24} />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4 text-primary-300">
                                            <div className="h-px w-12 bg-primary-500/50" />
                                            <span className="text-xs font-black uppercase tracking-widest">Client Priority Focus</span>
                                        </div>
                                        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight mb-4">
                                            {(ongoingSession || nextPatient)?.patient_name}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-6">
                                            <div className="flex items-center gap-3 text-slate-400">
                                                <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                                                    <Clock size={18} className="text-primary-300" />
                                                </div>
                                                <span className="text-lg font-bold">
                                                    Scheduled at {ongoingSession || nextPatient ? new Date((ongoingSession || nextPatient).start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-slate-400">
                                                <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                                                    <Briefcase size={18} className="text-purple-300" />
                                                </div>
                                                <span className="text-lg font-bold">Clinical Assessment</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-6 pt-10">
                                        <motion.button
                                            whileHover={{ scale: 1.02, y: -4, boxShadow: '0 20px 40px -10px rgba(59, 130, 246, 0.4)' }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => {
                                                const session = ongoingSession || nextPatient;
                                                if (session) window.location.href = `/doctor/session/${session.id}`;
                                            }}
                                            className="group relative bg-white text-slate-900 px-8 py-3.5 rounded-2xl font-black text-base flex items-center justify-center gap-4 overflow-hidden transition-all"
                                        >
                                            <div className="absolute inset-0 bg-primary-50 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                                            <PlayCircle size={24} className="relative z-10 text-primary-600" />
                                            <span className="relative z-10">{ongoingSession ? 'RESUME SESSION' : 'START SESSION'}</span>
                                            <ArrowRight size={20} className="relative z-10 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all" />
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                                            className="px-8 py-3.5 rounded-2xl font-black text-base text-white transition-all border-2 border-white/10 hover:border-white/30 flex items-center justify-center gap-3 backdrop-blur-md"
                                        >
                                            CASE FILE
                                            <FileText size={20} />
                                        </motion.button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                    <div className="relative mb-8">
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                                            transition={{ duration: 4, repeat: Infinity }}
                                            className="absolute inset-0 bg-emerald-500 rounded-full blur-2xl"
                                        />
                                        <div className="p-6 bg-emerald-500/10 backdrop-blur-3xl rounded-full border border-emerald-500/20 text-emerald-400">
                                            <CheckCircle2 size={50} strokeWidth={1} />
                                        </div>
                                    </div>
                                    <h2 className="text-3xl font-black text-white mb-2 tracking-tighter">Clinical Schedule Clear</h2>
                                    <p className="text-slate-400 text-base font-medium max-w-sm">You have successfully completed all scheduled sessions for today. Excellent work!</p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Intelligent Timeline */}
                <motion.div variants={itemVariants} className="xl:col-span-4 flex flex-col space-y-6">
                    <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col flex-1">
                        <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Timeline</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filteredAppointments.length} Results Today</p>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl text-slate-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all border border-transparent focus-within:border-primary-500/20">
                                <Search size={14} className="text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search patient..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-transparent border-none outline-none text-xs font-bold w-32 placeholder:text-slate-400 placeholder:font-medium"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar max-h-[500px]">
                            {filteredAppointments.length > 0 ? (
                                filteredAppointments.map((app, index) => (
                                    <motion.div
                                        key={app.id}
                                        whileHover={{ x: 6, backgroundColor: 'rgba(241, 245, 249, 0.5)' }}
                                        className={cn(
                                            "p-3.5 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between",
                                            app.status === 'SCHEDULED' ? "border-slate-100 bg-white" : "border-transparent bg-slate-50/50"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "h-10 w-10 rounded-xl flex flex-col items-center justify-center font-black transition-transform group-hover:scale-110",
                                                app.status === 'SCHEDULED' ? "bg-primary-50 text-primary-600 shadow-lg shadow-primary-500/10" : "bg-slate-200 text-slate-500"
                                            )}>
                                                <span className="text-sm leading-none">{new Date(app.start_time).getDate()}</span>
                                                <span className="text-[8px] font-black uppercase opacity-60">{new Date(app.start_time).toLocaleDateString('en-US', { month: 'short' })}</span>
                                            </div>
                                            <div>
                                                <p className={cn(
                                                    "font-black text-sm tracking-tight group-hover:text-primary-600 transition-colors uppercase",
                                                    app.status === 'SCHEDULED' ? "text-slate-900" : "text-slate-400"
                                                )}>
                                                    {app.patient_name}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Clock size={14} className="text-slate-400" />
                                                    <p className="text-xs font-bold text-slate-400">
                                                        {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{app.status}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight size={20} className="text-slate-300 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
                                    </motion.div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                    <div className="p-6 bg-slate-50 rounded-full text-slate-200">
                                        {searchQuery ? <Search size={40} /> : <Calendar size={40} />}
                                    </div>
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                                        {searchQuery ? 'No Match Found' : 'No Schedule Found'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* <button className="p-5 bg-slate-50/50 border-t border-slate-100 text-[10px] font-black text-slate-500 hover:text-primary-600 hover:bg-white transition-all flex items-center justify-center gap-3">
                            MANAGE ALL APPOINTMENTS
                            <ArrowRight size={14} />
                        </button> */}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}

// Minimal helper check
const CheckCircle2 = ({ size, className, strokeWidth = 2 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);
