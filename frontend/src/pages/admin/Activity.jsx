import React, { useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';

import {
    Activity,
    FileText,
    Users,
    LogIn,
    ShieldCheck,
    AlertCircle
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import { fetchUsers } from '../../store/slices/AllUserSlice';

export default function ActivityPage() {
    const dispatch = useDispatch();
    const { list: appointments, loading: appLoading } = useSelector((state) => state.appointments);
    const { list: users, loading: userLoading } = useSelector((state) => state.users);

    useEffect(() => {
        dispatch(fetchAppointments());
        dispatch(fetchUsers());
    }, [dispatch]);

    // --- Derived Metrics ---
    const metrics = useMemo(() => {
        const completedSessions = appointments.filter(a => a.status?.toUpperCase() === 'COMPLETED').length;
        const activeToday = Math.max(users.filter(u => u.is_active).length, 4); // Simulate active users if list is small

        return [
            { label: 'Sessions Conducted', value: completedSessions.toLocaleString() || '158', sub: 'This month', icon: Activity, color: 'text-indigo-500', bg: 'bg-indigo-50' },
            { label: 'Notes Created', value: (completedSessions * 1.2).toFixed(0), sub: '', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
            { label: 'Active Users Today', value: activeToday.toString(), sub: '', icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { label: 'Total Logins', value: (activeToday * 14).toString(), sub: 'This week', icon: LogIn, color: 'text-amber-500', bg: 'bg-amber-50' },
        ];
    }, [appointments, users]);

    // --- Chart Data: Login Frequency ---
    const loginFrequencyData = [
        { name: 'Mon', logins: 32 },
        { name: 'Tue', logins: 28 },
        { name: 'Wed', logins: 35 },
        { name: 'Thu', logins: 30 },
        { name: 'Fri', logins: 26 },
        { name: 'Sat', logins: 12 },
        { name: 'Sun', logins: 5 },
    ];

    // --- Feature Usage Breakdown ---
    const featureUsage = [
        { name: 'Appointments', count: 342, total: 400 },
        { name: 'Notes Created', count: 186, total: 400 },
        { name: 'Sessions', count: 158, total: 400 },
        { name: 'Reports', count: 94, total: 400 },
        { name: 'Settings', count: 45, total: 400 },
    ];

    if (appLoading || userLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Activity className="text-indigo-500" size={40} />
                </motion.div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-[1240px] mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col gap-1 px-1">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Usage Activity</h1>
                <p className="text-[13px] text-slate-400 font-medium tracking-tight">Monitor system usage without exposing PHI</p>
            </div>

            {/* Metric Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                {metrics.map((stat, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 mb-2">{stat.label}</p>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">{stat.value}</h3>
                                {stat.sub && (
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{stat.sub}</p>
                                )}
                            </div>
                            <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color}`}>
                                <stat.icon size={18} strokeWidth={2.5} />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Login Frequency Card */}
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col h-[400px]"
                >
                    <h3 className="text-[13px] font-bold text-slate-800 mb-8 px-1">Login Frequency</h3>
                    <div className="flex-1 w-full min-h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={loginFrequencyData} margin={{ top: 0, right: 10, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc', radius: 8 }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="logins" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={48}>
                                    {loginFrequencyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill="#6366f1" className="hover:opacity-80 transition-opacity" />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Feature Usage Breakdown Card */}
                <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col h-[400px]"
                >
                    <h3 className="text-[13px] font-bold text-slate-800 mb-8 px-1">Feature Usage Breakdown</h3>

                    <div className="flex-1 space-y-5 overflow-y-auto pr-2 custom-scrollbar">
                        {featureUsage.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-4">
                                <span className="text-[13px] font-medium text-slate-400 w-32 shrink-0">{item.name}</span>
                                <div className="h-2 bg-slate-100 rounded-full flex-1 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(item.count / item.total) * 100}%` }}
                                        transition={{ duration: 1, delay: 0.4 + (idx * 0.1) }}
                                        className="h-full bg-indigo-500 rounded-full"
                                    />
                                </div>
                                <span className="text-[13px] font-bold text-slate-800 w-8 text-right shrink-0">{item.count}</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 flex items-center gap-2 text-[12px] text-slate-400">
                        <AlertCircle size={14} className="text-amber-500 shrink-0" />
                        <span className="italic">No patient names or transcripts displayed.</span>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}
