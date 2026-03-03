import React, { useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import {
    Calendar,
    BarChart3,
    TrendingUp,
    Users,
    TrendingDown,
    Activity
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import { fetchUsers } from '../../store/slices/AllUserSlice';

export default function Analytics() {
    const dispatch = useDispatch();
    const { list: appointments, loading: appLoading } = useSelector((state) => state.appointments);
    const { list: users, loading: userLoading } = useSelector((state) => state.users);

    useEffect(() => {
        dispatch(fetchAppointments());
        dispatch(fetchUsers());
    }, [dispatch]);

    // --- Derived Metrics ---
    const stats = useMemo(() => {
        const total = appointments.length;
        const doctors = users.filter(u => u.role?.toUpperCase() === 'DOCTOR');

        // Calculate Cancellation Rate
        const cancelledCount = appointments.filter(a => a.status?.toUpperCase() === 'CANCELLED').length;
        const cancelRate = total > 0 ? ((cancelledCount / total) * 100).toFixed(1) : "0.0";

        // Mock data for trends and utilization for now, blending with real total
        return [
            { label: 'Total Appointments', value: total.toLocaleString(), change: '+12% vs last period', icon: Calendar, color: 'text-indigo-500', bg: 'bg-indigo-50' },
            { label: 'Avg. Daily', value: Math.round(total / 30) || '0', change: null, icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-50' },
            { label: 'Cancellation Rate', value: `${cancelRate}%`, change: '-1.4%', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { label: 'Avg. Utilization', value: '77%', change: null, icon: Users, color: 'text-amber-500', bg: 'bg-amber-50' },
        ];
    }, [appointments, users]);

    // --- Chart Data ---
    const monthlyData = [
        { name: 'Jan', appointments: 240, cancellations: 24 },
        { name: 'Feb', appointments: 280, cancellations: 18 },
        { name: 'Mar', appointments: 310, cancellations: 26 },
        { name: 'Apr', appointments: 290, cancellations: 22 },
        { name: 'May', appointments: 340, cancellations: 30 },
        { name: 'Jun', appointments: 360, cancellations: 20 },
    ];

    const doctorUtilization = useMemo(() => {
        const docs = users.filter(u => u.role?.toUpperCase() === 'DOCTOR').slice(0, 5);
        if (docs.length === 0) {
            return [
                { name: 'Dr. Chen', rate: 92 },
                { name: 'Dr. Park', rate: 85 },
                { name: 'Dr. Rodriguez', rate: 78 },
                { name: 'Dr. Wilson', rate: 45 },
                { name: 'Dr. Kim', rate: 88 },
            ];
        }
        return docs.map(d => ({
            name: `Dr. ${d.full_name?.split(' ')[0] || d.id}`,
            rate: Math.floor(Math.random() * (95 - 40 + 1)) + 40
        })).sort((a, b) => b.rate - a.rate);
    }, [users]);

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
        <div className="space-y-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-1 px-1">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Analytics</h1>
                <p className="text-[13px] text-slate-400 font-medium">Appointment and operational insights</p>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{stat.label}</p>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">{stat.value}</h3>
                            </div>
                            <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color}`}>
                                <stat.icon size={20} strokeWidth={2.5} />
                            </div>
                        </div>
                        {stat.change && (
                            <p className={`text-[11px] font-bold ${stat.change.includes('+') ? 'text-emerald-500' : 'text-emerald-500'}`}>
                                {stat.change}
                            </p>
                        )}
                    </motion.div>
                ))}
            </div>
            

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">

                {/* Monthly Appointments Area Chart */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col h-[380px]"
                >
                    <h3 className="text-[13px] font-bold text-slate-800 mb-6 px-1">Monthly Appointments</h3>
                    <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
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
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="appointments"
                                    stroke="#6366f1"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#colorApps)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="cancellations"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    fillOpacity={0}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Doctor Utilization Bar Chart */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col h-[380px]"
                >
                    <h3 className="text-[13px] font-bold text-slate-800 mb-6 px-1">Doctor Utilization Rate</h3>
                    <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                layout="vertical"
                                data={doctorUtilization}
                                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    style={{ fontSize: '11px', fontWeight: 'bold', fill: '#64748b' }}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={24}>
                                    {doctorUtilization.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill="#6366f1" />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}
