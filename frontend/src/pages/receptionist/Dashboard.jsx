import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Calendar,
    Clock,
    UserPlus,
    Activity,
    ArrowRight,
    Search,
    ChevronRight,
    Sparkles,
    CalendarCheck,
    Contact2,
    Stethoscope
} from 'lucide-react';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';

export default function ReceptionistDashboard() {
    const dispatch = useDispatch();
    const { list: patients, loading: patientsLoading } = useSelector((state) => state.patients);
    const { list: appointments, loading: appointmentsLoading } = useSelector((state) => state.appointments);

    useEffect(() => {
        dispatch(fetchPatients());
        dispatch(fetchAppointments());
    }, [dispatch]);

    const today = new Date().toISOString().split('T')[0];
    const todaysAppointments = appointments
        .filter(app => app.start_time.startsWith(today))
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const stats = [
        {
            label: 'Today\'s Appointments',
            value: todaysAppointments.length,
            icon: Calendar,
            gradient: 'from-blue-500 to-cyan-500',
            change: 'Check clinical schedule'
        },
        {
            label: 'Total Patients',
            value: patients.length,
            icon: Users,
            gradient: 'from-emerald-500 to-teal-500',
            change: '+3 new this week'
        },
        {
            label: 'Incoming Check-ins',
            value: '4',
            icon: Clock,
            gradient: 'from-orange-500 to-amber-500',
            change: 'In the next hour'
        },
    ];

    if (patientsLoading || appointmentsLoading) {
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
            {/* Header */}
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
                        Front Desk <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">Command Center</span>
                    </h1>
                    <p className="text-slate-500 font-medium flex items-center gap-2">
                        <Contact2 size={18} className="text-primary-500" />
                        Managing patient flow and scheduling for today.
                    </p>
                </div>
                <div className="flex gap-3">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => window.location.href = '/receptionist/patients'}
                        className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-100 text-slate-700 rounded-2xl shadow-sm hover:bg-slate-50 transition-all font-bold"
                    >
                        <UserPlus size={18} className="text-primary-600" />
                        REGISTER PATIENT
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => window.location.href = '/receptionist/appointments'}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl shadow-xl shadow-primary-500/30 font-bold"
                    >
                        <Calendar size={18} />
                        BOOK APPOINTMENT
                    </motion.button>
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
                                    <div className="flex items-center gap-1 text-[10px] font-black text-primary-600 uppercase tracking-wider bg-primary-50 px-2 py-1 rounded-full border border-primary-100">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Schedule Preview */}
                <motion.div
                    variants={itemVariants}
                    className="backdrop-blur-xl bg-white/80 rounded-[2.5rem] shadow-xl border border-white/50 overflow-hidden flex flex-col"
                >
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <CalendarCheck size={24} className="text-primary-600" />
                            Active Timeline
                        </h3>
                        <a href="/receptionist/appointments" className="text-sm font-black text-primary-600 hover:underline">VIEW FULL CALENDAR</a>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto custom-scrollbar max-h-[400px]">
                        {todaysAppointments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                                <Calendar size={48} className="mb-4 text-slate-300" />
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Sessions Found</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {todaysAppointments.map((app, index) => (
                                    <motion.div
                                        key={app.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.4 + index * 0.1 }}
                                        whileHover={{ x: 5, backgroundColor: 'rgba(248, 250, 252, 0.8)' }}
                                        className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-primary-100 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                                                <span className="text-primary-600 font-black text-sm">
                                                    {new Date(app.start_time).getHours()}:{new Date(app.start_time).getMinutes().toString().padStart(2, '0')}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 uppercase tracking-tight group-hover:text-primary-600 transition-colors">
                                                    {app.patient_name || 'Patient TBD'}
                                                </p>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                                    <Stethoscope size={10} className="text-primary-400" />
                                                    CONSULTATION WITH DR. {app.doctor_name?.toUpperCase() || 'ASSIGNED'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="px-3 py-1 bg-primary-50 text-primary-600 text-[10px] font-black rounded-full uppercase border border-primary-100">
                                                {app.status}
                                            </span>
                                            <div className="p-2 rounded-lg text-slate-300 group-hover:text-primary-600 transition-colors">
                                                <ArrowRight size={18} />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Quick Registration / Search */}
                <motion.div
                    variants={itemVariants}
                    className="backdrop-blur-xl bg-white/80 rounded-[2.5rem] shadow-xl border border-white/50 overflow-hidden flex flex-col items-center justify-center text-center p-12 relative"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-50/50 to-indigo-50/50 -z-10" />
                    <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="p-8 bg-white rounded-full shadow-2xl shadow-primary-500/10 mb-8 border-2 border-primary-50"
                    >
                        <Search size={60} className="text-primary-600" />
                    </motion.div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">Patient Search</h3>
                    <p className="text-slate-500 font-medium mb-8 max-w-xs">Instantly locate patient files or check-in upcoming appointments.</p>
                    <div className="w-full relative px-4 text-left">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Search Registry</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Name, ID or Phone number..."
                                className="w-full py-4 pl-12 pr-4 bg-white border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all font-bold placeholder:text-slate-400 shadow-sm"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
