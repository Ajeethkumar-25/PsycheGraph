import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    Users,
    Stethoscope,
    UserCheck,
    Calendar,
    TrendingUp,
    Activity,
    ArrowRight,
    Search,
    UserPlus,
    BarChart3,
    Sparkles,
    Clock
} from 'lucide-react';
import { fetchUsers } from '../../store/slices/AllUserSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';

export default function AdminDashboard() {
    const dispatch = useDispatch();
    const { list: users, loading: usersLoading } = useSelector((state) => state.users);
    const { list: patients, loading: patientsLoading } = useSelector((state) => state.patients);
    const { list: appointments, loading: appointmentsLoading } = useSelector((state) => state.appointments);

    useEffect(() => {
        dispatch(fetchUsers());
        dispatch(fetchPatients());
        dispatch(fetchAppointments());
    }, [dispatch]);

    const doctorsCount = users.filter(user => user.role === 'DOCTOR').length;
    const receptionistsCount = users.filter(user => user.role === 'RECEPTIONIST').length;
    const patientsCount = patients.length;

    // Real appointment stats
    const totalAppointments = appointments.length;
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = appointments.filter(app => app.date === today).length;

    const stats = [
        {
            label: 'Active Doctors',
            value: doctorsCount,
            icon: Stethoscope,
            color: 'blue',
            bgColor: 'bg-blue-50',
            textColor: 'text-blue-600',
            change: '+2 this month'
        },
        {
            label: 'Receptionists',
            value: receptionistsCount,
            icon: UserCheck,
            color: 'cyan',
            bgColor: 'bg-cyan-50',
            textColor: 'text-cyan-600',
            change: 'Stable'
        },
        {
            label: 'Total Patients',
            value: patientsCount,
            icon: Users,
            color: 'blue',
            bgColor: 'bg-blue-50',
            textColor: 'text-blue-600',
            change: '+15% growth'
        },
        {
            label: 'Appointments',
            value: totalAppointments,
            icon: Calendar,
            color: 'cyan',
            bgColor: 'bg-cyan-50',
            textColor: 'text-cyan-600',
            change: `${todayAppointments} today`
        },
    ];

    if (usersLoading || patientsLoading || appointmentsLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                    <Activity className="text-blue-500" size={40} />
                </motion.div>
            </div>
        );
    }

    const recentActivity = [
        ...users.slice(0, 3).map(u => ({ type: 'user', name: u.full_name, role: u.role, time: 'Recently joined' })),
        ...patients.slice(0, 2).map(p => ({ type: 'patient', name: p.full_name, role: 'PATIENT', time: 'New registration' }))
    ].sort(() => Math.random() - 0.5);

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-end justify-between gap-4"
            >
                <div>
                    <p className="text-sm font-semibold text-blue-600 mb-1">Hospital Management</p>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                        Organization Dashboard
                    </h1>
                    <p className="text-slate-500 mt-1 flex items-center gap-2">
                        <BarChart3 size={16} />
                        Overview of clinic operations and staff management
                    </p>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
                {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            whileHover={{ y: -4 }}
                            className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                                    <Icon size={20} className={stat.textColor} strokeWidth={2.5} />
                                </div>
                                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
                                    <TrendingUp size={12} />
                                    {stat.change}
                                </span>
                            </div>
                            <p className="text-sm font-semibold text-slate-500 mb-1">{stat.label}</p>
                            <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                        </motion.div>
                    );
                })}
            </motion.div>

            {/* Quick Actions & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Appointments Panel */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-2xl border border-slate-200 p-6"
                >
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Calendar size={20} className="text-blue-600" />
                        Today's Appointments
                    </h3>
                    <div className="space-y-3">
                        {todayAppointments > 0 ? (
                            appointments
                                .filter(app => app.date === today)
                                .slice(0, 4)
                                .map((appointment, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                                <Calendar size={16} />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-900 text-sm">
                                                    {appointment.patient_name || 'Patient'}
                                                </h4>
                                                <p className="text-[10px] font-semibold text-slate-400">
                                                    Dr. {appointment.doctor_name || 'Assigned Doctor'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-slate-500">
                                                {appointment.time_slot || 'TBD'}
                                            </span>
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-semibold ${appointment.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-600' :
                                                    appointment.status === 'PENDING' ? 'bg-amber-50 text-amber-600' :
                                                        'bg-slate-50 text-slate-600'
                                                }`}>
                                                {appointment.status}
                                            </span>
                                        </div>
                                    </div>
                                ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <div className="p-4 bg-slate-50 rounded-full mb-4">
                                    <Calendar size={28} className="text-slate-300" />
                                </div>
                                <p className="text-sm font-semibold text-slate-400">No appointments today</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Recent Activity Panel */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-2xl border border-slate-200 p-6"
                >
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Activity size={20} className="text-blue-600" />
                        Recent Activity
                    </h3>
                    <div className="space-y-3">
                        {recentActivity.length > 0 ? recentActivity.map((activity, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${activity.type === 'user' ? 'bg-blue-50 text-blue-600' : 'bg-cyan-50 text-cyan-600'}`}>
                                        {activity.type === 'user' ? <UserCheck size={16} /> : <Users size={16} />}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 text-sm">{activity.name}</h4>
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{activity.role}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                                    <Clock size={10} />
                                    {activity.time}
                                </span>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <div className="p-4 bg-slate-50 rounded-full mb-4">
                                    <Activity size={28} className="text-slate-300" />
                                </div>
                                <p className="text-sm font-semibold text-slate-400">No recent activity found</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
