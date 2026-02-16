import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    Users,
    Calendar,
    Clock,
    UserPlus,
    Loader2,
    ArrowRight,
    Search,
    CalendarCheck,
    Stethoscope,
    TrendingUp,
    ArrowUpRight
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
            label: "Today's Appointments",
            value: todaysAppointments.length,
            icon: Calendar,
            color: 'bg-indigo-50 text-indigo-600',
            iconBg: 'bg-indigo-100',
            sub: 'Scheduled for today'
        },
        {
            label: 'Total Patients',
            value: patients.length,
            icon: Users,
            color: 'bg-emerald-50 text-emerald-600',
            iconBg: 'bg-emerald-100',
            sub: 'Registered in system'
        },
        {
            label: 'Upcoming Check-ins',
            value: '4',
            icon: Clock,
            color: 'bg-amber-50 text-amber-600',
            iconBg: 'bg-amber-100',
            sub: 'In the next hour'
        },
    ];

    if (patientsLoading || appointmentsLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin text-indigo-500" size={36} />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-end justify-between gap-4"
            >
                <div>
                    <p className="text-sm font-semibold text-indigo-600 mb-1">Receptionist Portal</p>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                        Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'} 👋
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Here's what's happening at your front desk today.
                    </p>
                </div>
                <div className="flex gap-3">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => window.location.href = '/receptionist/patients'}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-semibold text-sm shadow-sm"
                    >
                        <UserPlus size={16} className="text-indigo-500" />
                        Register Patient
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => window.location.href = '/receptionist/appointments'}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/25 font-semibold text-sm hover:bg-indigo-700 transition-all"
                    >
                        <Calendar size={16} />
                        Book Appointment
                    </motion.button>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-300 cursor-default"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-2.5 rounded-xl ${stat.iconBg}`}>
                                    <Icon size={20} className={stat.color.split(' ')[1]} />
                                </div>
                                <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                    <TrendingUp size={12} />
                                    <span>Active</span>
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</p>
                            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                            <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
                        </motion.div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Schedule Preview - takes 3 columns */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col"
                >
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-50">
                                <CalendarCheck size={18} className="text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Today's Schedule</h3>
                        </div>
                        <a href="/receptionist/appointments" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors">
                            View all
                            <ArrowUpRight size={14} />
                        </a>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[420px]">
                        {todaysAppointments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="p-4 rounded-full bg-slate-50 mb-4">
                                    <Calendar size={32} className="text-slate-300" />
                                </div>
                                <p className="text-sm font-semibold text-slate-400">No appointments for today</p>
                                <p className="text-xs text-slate-400 mt-1">New bookings will appear here</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {todaysAppointments.map((app, index) => (
                                    <motion.div
                                        key={app.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.4 + index * 0.05 }}
                                        className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-11 w-11 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                                                <span className="text-indigo-600 font-bold text-sm">
                                                    {new Date(app.start_time).getHours().toString().padStart(2, '0')}:{new Date(app.start_time).getMinutes().toString().padStart(2, '0')}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                    {app.patient_name || 'Patient TBD'}
                                                </p>
                                                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <Stethoscope size={10} />
                                                    Dr. {app.doctor_name || 'Assigned'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${app.status === 'SCHEDULED' ? 'bg-blue-50 text-blue-600' :
                                                    app.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' :
                                                        'bg-red-50 text-red-600'
                                                }`}>
                                                {app.status}
                                            </span>
                                            <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Quick Search - takes 2 columns */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col"
                >
                    <div className="px-6 py-5 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-50">
                                <Search size={18} className="text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Quick Search</h3>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="p-6 bg-gradient-to-br from-indigo-50 to-slate-50 rounded-2xl mb-6">
                            <Search size={40} className="text-indigo-400" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 mb-1">Find a Patient</h4>
                        <p className="text-sm text-slate-500 mb-6 max-w-[240px]">Search by name, ID, or phone to quickly find patients.</p>
                        <div className="w-full relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search patients..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => window.location.href = '/receptionist/patients'}
                            className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                        >
                            Go to Patient Registry
                            <ArrowUpRight size={14} />
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
