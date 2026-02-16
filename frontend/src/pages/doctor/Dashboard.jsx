import { useEffect } from 'react';
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
    Sparkles
} from 'lucide-react';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';

export default function DoctorDashboard() {
    const dispatch = useDispatch();
    const { list: appointments, loading: appLoading } = useSelector((state) => state.appointments);
    const { list: patients, loading: patLoading } = useSelector((state) => state.patients);

    useEffect(() => {
        dispatch(fetchAppointments());
        dispatch(fetchPatients());
    }, [dispatch]);

    const today = new Date().toISOString().split('T')[0];
    const todaysAppointments = appointments
        .filter(app => app.start_time.startsWith(today))
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    const nextPatient = todaysAppointments.find(app => app.status === 'SCHEDULED');

    if (appLoading || patLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                    <Activity className="text-primary-500" size={40} />
                </motion.div>
            </div>
        );
    }

    const stats = [
        {
            label: 'Total Patients',
            value: patients.length,
            icon: Users,
            gradient: 'from-blue-500 to-cyan-500',
            change: '+5 today'
        },
        {
            label: 'Today\'s Appointments',
            value: todaysAppointments.length,
            icon: Calendar,
            gradient: 'from-emerald-500 to-teal-500',
            change: '3 remaining'
        },
        {
            label: 'Pending Clinical Notes',
            value: '2',
            icon: FileText,
            gradient: 'from-orange-500 to-amber-500',
            change: 'Action required'
        },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8 pb-10"
        >
            {/* Header Section */}
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
                        Good morning, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">Dr. Sarah</span>
                    </h1>
                    <p className="text-slate-500 font-medium flex items-center gap-2">
                        <Stethoscope size={18} className="text-primary-500" />
                        You have {todaysAppointments.length} appointments scheduled for today.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2"
                    >
                        <Clock size={16} className="text-primary-500" />
                        <span className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </motion.div>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={stat.label}
                            whileHover={{ y: -5, scale: 1.02 }}
                            className="relative group"
                        >
                            <div className="backdrop-blur-xl bg-white/80 p-6 rounded-3xl shadow-xl border border-white/50 overflow-hidden">
                                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-3 rounded-2xl bg-gradient-to-br ${stat.gradient} shadow-lg shadow-primary-500/20`}>
                                        <Icon size={24} className="text-white" />
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-full">
                                        <TrendingUp size={12} />
                                        {stat.change}
                                    </div>
                                </div>
                                <p className="text-sm font-bold text-slate-400 mb-1">{stat.label}</p>
                                <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>

            {/* Main Dashboard Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Next Up / Main Action Card */}
                <motion.div variants={itemVariants} className="lg:col-span-2 relative group overflow-hidden rounded-[2.5rem] shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800" />
                    <motion.div
                        animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
                        transition={{ duration: 10, repeat: Infinity }}
                        className="absolute -right-20 -top-20 w-96 h-96 bg-white rounded-full blur-3xl pointer-events-none"
                    />

                    <div className="relative z-10 p-10 h-full flex flex-col justify-between min-h-[400px]">
                        {nextPatient ? (
                            <>
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-white/80 text-xs font-black uppercase tracking-widest mb-6">
                                        <Sparkles size={14} className="text-amber-400" />
                                        Incoming Session
                                    </div>
                                    <h2 className="text-white/70 text-lg font-bold mb-2">Next Patient Up</h2>
                                    <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-4 mb-8">
                                        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-none">
                                            {nextPatient.patient_name}
                                        </h1>
                                        <p className="text-2xl text-primary-200 font-bold mb-1">
                                            at {new Date(nextPatient.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => window.location.href = `/doctor/session/${nextPatient.patient_id}`}
                                        className="bg-white text-primary-700 px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-primary-50 transition-all shadow-xl"
                                    >
                                        <PlayCircle size={24} />
                                        START CLINICAL SESSION
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                                        className="px-8 py-4 rounded-2xl font-bold text-white transition-all border-2 border-white/20 flex items-center justify-center gap-2"
                                    >
                                        PRE-SESSION REVIEW
                                        <ChevronRight size={20} />
                                    </motion.button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center py-20">
                                <motion.div
                                    animate={{ y: [0, -10, 0] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="p-6 bg-white/10 backdrop-blur-md rounded-full mb-6"
                                >
                                    <CheckCircle2 size={60} className="text-white" />
                                </motion.div>
                                <h2 className="text-4xl font-black text-white mb-2">All Caught Up!</h2>
                                <p className="text-primary-100 text-lg">No more appointments scheduled for today.</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Today's Schedule Card */}
                <motion.div
                    variants={itemVariants}
                    className="backdrop-blur-xl bg-white/80 rounded-[2.5rem] shadow-xl border border-white/50 overflow-hidden flex flex-col"
                >
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Today's Timeline</h3>
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {todaysAppointments.length > 0 ? (
                            todaysAppointments.map((app, index) => (
                                <motion.div
                                    key={app.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 + index * 0.1 }}
                                    whileHover={{ x: -4, backgroundColor: 'rgba(248, 250, 252, 0.8)' }}
                                    className="p-4 rounded-2xl border border-slate-100 hover:border-primary-100 transition-all cursor-pointer group flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "h-12 w-12 rounded-xl flex flex-col items-center justify-center font-black text-[10px]",
                                            app.status === 'SCHEDULED' ? "bg-primary-50 text-primary-600" : "bg-slate-100 text-slate-500"
                                        )}>
                                            <span className="leading-none">{new Date(app.start_time).getHours()}</span>
                                            <span className="opacity-50">OCT</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors uppercase tracking-tight">
                                                {app.patient_name}
                                            </p>
                                            <p className="text-xs font-semibold text-slate-400">
                                                {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        app.status === 'SCHEDULED' ? "text-primary-400 group-hover:text-primary-600" : "text-slate-300"
                                    )}>
                                        <ArrowRight size={18} />
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50 px-8">
                                <Calendar size={48} className="mb-4 text-slate-300" />
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Sessions Found</p>
                            </div>
                        )}
                    </div>

                    <button className="p-6 bg-slate-50 border-t border-slate-100 text-sm font-black text-slate-500 hover:text-primary-600 transition-colors flex items-center justify-center gap-2">
                        MANAGE CALENDAR
                        <ChevronRight size={16} />
                    </button>
                </motion.div>
            </div>
        </motion.div>
    );
}

// Minimal helper check
const CheckCircle2 = ({ size, className }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);
