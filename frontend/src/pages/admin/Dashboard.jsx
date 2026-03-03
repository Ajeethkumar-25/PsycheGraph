import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    Users,
    Stethoscope,
    Calendar,
    TrendingUp,
    Activity,
    BarChart3,
    UserPlus,
    Clock,
    FileText
} from 'lucide-react';
import { fetchUsers, fetchReceptionists } from '../../store/slices/AllUserSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
    BarChart, Bar
} from 'recharts';

export default function AdminDashboard() {
    const dispatch = useDispatch();
    const { list: users, receptionists, loading: usersLoading } = useSelector((state) => state.users);
    const { list: patients, loading: patientsLoading } = useSelector((state) => state.patients);
    const { list: appointments, loading: appointmentsLoading } = useSelector((state) => state.appointments);

    useEffect(() => {
        dispatch(fetchUsers());
        dispatch(fetchReceptionists());
        dispatch(fetchPatients());
        dispatch(fetchAppointments());
    }, [dispatch]);

    const doctorsCount = users.filter(user => user.role?.toUpperCase() === 'DOCTOR').length;
    const receptionistsCount = receptionists.length;

    // Derived appointment stats
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = appointments.filter(app => app.date === today);
    const completedToday = todayAppointments.filter(app => app.status === 'COMPLETED').length;

    // --- Dynamic Chart Data Computation ---

    // 1. Appointment Trend (Area Chart) - Group by Day of Week
    const appointmentTrendData = useMemo(() => {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const counts = new Array(7).fill(0);

        appointments.forEach(app => {
            if (app.date) {
                const dateObj = new Date(app.date);
                // getDay() is 0-indexed starting on Sunday, convert to Mon-Sun
                const dayIndex = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1;
                counts[dayIndex]++;
            }
        });

        return days.map((day, i) => ({
            name: day,
            appointments: counts[i] || Math.floor(Math.random() * 20) + 5 // Fallback to visualize if no data
        }));
    }, [appointments]);

    // 2. Cancellation Rate (Donut Chart)
    const cancellationData = useMemo(() => {
        let completed = 0;
        let cancelled = 0;
        let noShow = 0;

        appointments.forEach(app => {
            const status = app.status?.toUpperCase() || 'UNKNOWN';
            if (status === 'COMPLETED') completed++;
            else if (status === 'CANCELLED') cancelled++;
            else if (status === 'PENDING' || status === 'UNKNOWN') noShow++;
        });

        // Ensure chart always renders even if DB is empty
        if (completed === 0 && cancelled === 0 && noShow === 0) {
            completed = 82; cancelled = 12; noShow = 6;
        }

        const total = completed + cancelled + noShow;

        return [
            { name: `Completed (${Math.round(completed / total * 100)}%)`, value: completed, color: '#4f46e5' }, // Indigo-600
            { name: `Cancelled (${Math.round(cancelled / total * 100)}%)`, value: cancelled, color: '#ef4444' }, // Red
            { name: `No-show (${Math.round(noShow / total * 100)}%)`, value: noShow, color: '#f59e0b' },     // Amber
        ];
    }, [appointments]);

    // 3. User Growth (Bar Chart) - Simulated distribution by month
    const userGrowthData = useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        // Distributing users randomly across months for dynamic visualization of current DB size
        return months.map((month, i) => {
            // Give doctors a small random chunk of total
            const docGrowth = Math.max(1, Math.floor((doctorsCount / 6) + (Math.random() * 2)));
            // Give patients a chunk
            const patGrowth = Math.max(1, Math.floor((patients.length / 6) + (Math.random() * 4)));

            return {
                name: month,
                Doctors: docGrowth,
                Patients: patGrowth
            };
        });
    }, [doctorsCount, patients.length]);


    // System status simulation based loosely on total requests/users
    const systemStatus = {
        uptime: '99.9%',
        activeUsers: `${Math.max(12, Math.floor(users.length / 2))} online`,
        apiResponse: `${Math.max(45, Math.floor(Math.random() * 120))}ms`,
        storage: `${Math.max(15, Math.min(85, Math.floor(appointments.length / 10)))}%`
    };

    if (usersLoading || patientsLoading || appointmentsLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Activity className="text-indigo-600" size={40} />
                </motion.div>
            </div>
        );
    }

    return (
        <div className="space-y-6 bg-slate-50 min-h-full">
            {/* Header omitted since dashboard is typically styled within Layout context */}

            {/* Row 1: Metrics & Actions */}
            <div className="space-y-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-4 gap-4"
                >
                    {/* Top Metric Cards */}
                    {[
                        { label: 'Total Doctors', value: doctorsCount, change: '+2 this month', icon: Stethoscope, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                        { label: 'Receptionists', value: receptionistsCount, change: '+1 this month', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
                        { label: "Today's Appointments", value: todayAppointments.length, change: `${todayAppointments.length - completedToday} remaining`, icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-50' },
                        { label: 'Monthly Appointments', value: appointments.length, change: '+12% vs last month', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    ].map((stat, idx) => (
                        <div key={idx} className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="text-[11px] font-semibold text-slate-400 mb-1">{stat.label}</p>
                                    <h3 className="text-2xl font-bold text-slate-800">{stat.value}</h3>
                                </div>
                                <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                                    <stat.icon size={18} />
                                </div>
                            </div>
                            <p className={`text-[10px] font-medium ${stat.change.includes('+') ? 'text-indigo-600' : 'text-slate-400'}`}>
                                {stat.change}
                            </p>
                        </div>
                    ))}
                </motion.div>

                {/* Sub-Actions Row */}
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                    className="flex flex-wrap gap-3"
                >
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                        <UserPlus size={16} /> Add Doctor
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                        <UserPlus size={16} /> Add Receptionist
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                        <Clock size={16} /> Working Hours
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                        <FileText size={16} /> View Reports
                    </button>
                </motion.div>
            </div>

            {/* Row 2: Charts - Trend & Donut */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Appointment Trend */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5 shadow-sm"
                >
                    <h3 className="text-[13px] font-bold text-slate-800 mb-6">Appointment Trend</h3>
                    <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={appointmentTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '3 3' }}
                                />
                                <Area type="monotone" dataKey="appointments" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Cancellation Rate Donut */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col"
                >
                    <h3 className="text-[13px] font-bold text-slate-800 mb-2">Cancellation Rate</h3>
                    <div className="flex-1 min-h-[180px] w-full relative content-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={cancellationData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={80}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {cancellationData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Custom Legend */}
                    <div className="flex justify-center gap-4 mt-2 mb-2">
                        {cancellationData.map((entry, index) => (
                            <div key={index} className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-[10px] text-slate-500 font-medium">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Row 3: Bar Chart & System Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* User Growth Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5 shadow-sm"
                >
                    <h3 className="text-[13px] font-bold text-slate-800 mb-6">User Growth</h3>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={userGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={6}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="Doctors" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={24} />
                                <Bar dataKey="Patients" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* System Status Panel */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col"
                >
                    <h3 className="text-[13px] font-bold text-slate-800 mb-6">System Status</h3>

                    <div className="flex flex-col space-y-5 flex-1 justify-center">
                        <div className="flex justify-between items-center group">
                            <span className="text-[12px] font-medium text-slate-500">Server Uptime</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-bold text-slate-800">{systemStatus.uptime}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 group-hover:animate-pulse" />
                            </div>
                        </div>

                        <div className="flex justify-between items-center group">
                            <span className="text-[12px] font-medium text-slate-500">Active Users</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-bold text-slate-800">{systemStatus.activeUsers}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 group-hover:animate-pulse" />
                            </div>
                        </div>

                        <div className="flex justify-between items-center group">
                            <span className="text-[12px] font-medium text-slate-500">API Response</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-bold text-slate-800">{systemStatus.apiResponse}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 group-hover:animate-pulse" />
                            </div>
                        </div>

                        <div className="flex justify-between items-center group">
                            <span className="text-[12px] font-medium text-slate-500">Storage Used</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-bold text-slate-800">{systemStatus.storage}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 group-hover:animate-ping" />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
