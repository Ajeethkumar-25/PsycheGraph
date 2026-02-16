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
    Sparkles
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
            gradient: 'from-blue-500 to-cyan-500',
            change: '+2 this month'
        },
        {
            label: 'Receptionists',
            value: receptionistsCount,
            icon: UserCheck,
            gradient: 'from-emerald-500 to-teal-500',
            change: 'Stable'
        },
        {
            label: 'Total Patients',
            value: patientsCount,
            icon: Users,
            gradient: 'from-purple-500 to-pink-500',
            change: '+15% growth'
        },
        {
            label: 'Appointments',
            value: totalAppointments,
            icon: Calendar,
            gradient: 'from-orange-500 to-amber-500',
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
                    <Activity className="text-primary-500" size={40} />
                </motion.div>
            </div>
        );
    }

    const recentActivity = [
        ...users.slice(0, 3).map(u => ({ type: 'user', name: u.full_name, role: u.role, time: 'Recently joined' })),
        ...patients.slice(0, 2).map(p => ({ type: 'patient', name: p.full_name, role: 'PATIENT', time: 'New registration' }))
    ].sort(() => Math.random() - 0.5); // Simple shuffle for variety

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
                        Organization <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">Analytics</span>
                    </h1>
                    <p className="text-slate-500 font-medium flex items-center gap-2">
                        <BarChart3 size={18} className="text-primary-500" />
                        Overview of clinic operations and staff management.
                    </p>
                </div>
                {/* <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => window.location.href = '/admin/users'}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl shadow-xl shadow-primary-500/30 font-bold"
                >
                    <UserPlus size={18} />
                    ADD NEW STAFF
                </motion.button> */}
            </motion.div>

            {/* Stats Grid */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

            {/* Quick Actions & Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Actions Panel */}
                <motion.div
                    variants={itemVariants}
                    className="backdrop-blur-xl bg-white/80 rounded-[2.5rem] shadow-xl border border-white/50 overflow-hidden flex flex-col p-8"
                >
                    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6 flex items-center gap-2">
                        <Sparkles size={24} className="text-primary-600" />
                        Quick Actions
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            {
                                title: 'Add Doctor',
                                icon: Stethoscope,
                                color: 'blue',
                                path: '/admin/users'
                            },
                            {
                                title: 'Add Staff',
                                icon: UserPlus,
                                color: 'purple',
                                path: '/admin/users'
                            },
                            {
                                title: 'All Users',
                                icon: Users,
                                color: 'emerald',
                                path: '/admin/users'
                            },
                            {
                                title: 'Analytics',
                                icon: BarChart3,
                                color: 'orange',
                                path: '#'
                            },
                        ].map((action) => (
                            <motion.button
                                key={action.title}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => action.path !== '#' && (window.location.href = action.path)}
                                className="p-4 rounded-3xl border-2 border-slate-50 hover:border-primary-100 hover:bg-primary-50/30 transition-all text-left flex flex-col gap-3 group"
                            >
                                <div className={`p-3 rounded-2xl bg-${action.color}-50 text-${action.color}-600 w-fit group-hover:bg-${action.color}-600 group-hover:text-white transition-all`}>
                                    <action.icon size={20} />
                                </div>
                                <span className="font-bold text-slate-700 text-sm">{action.title}</span>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>

                {/* Recent Activity Panel */}
                <motion.div
                    variants={itemVariants}
                    className="backdrop-blur-xl bg-white/80 rounded-[2.5rem] shadow-xl border border-white/50 overflow-hidden flex flex-col p-8"
                >
                    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6 flex items-center gap-2">
                        <Activity size={24} className="text-primary-600" />
                        Recent Activity
                    </h3>
                    <div className="space-y-4">
                        {recentActivity.length > 0 ? recentActivity.map((activity, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100/50">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-xl ${activity.type === 'user' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {activity.type === 'user' ? <UserCheck size={18} /> : <Users size={18} />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-sm">{activity.name}</h4>
                                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{activity.role}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">{activity.time}</span>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <div className="p-4 bg-slate-50 rounded-full mb-4">
                                    <Activity size={32} className="text-slate-300" />
                                </div>
                                <p className="text-slate-500 font-medium">No recent activity found</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
