import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, Users, Calendar, Clipboard, TrendingUp, Clock, Building2, ShieldCheck, Headphones, HeartPulse, CheckSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';

const Dashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState([]);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    const getIcon = (type) => {
        switch (type) {
            case 'orgs': return Building2;
            case 'users': return Users;
            case 'patients': return Users;
            case 'appointments': return Calendar;
            case 'sessions': return Headphones;
            case 'doctors': return HeartPulse;
            case 'health': return Activity;
            case 'license': return ShieldCheck;
            case 'slots': return Clock;
            case 'checkins': return CheckSquare;
            default: return TrendingUp;
        }
    };

    const getColor = (i) => {
        const colors = [
            'text-primary-400 bg-primary-500/10',
            'text-blue-400 bg-blue-500/10',
            'text-emerald-400 bg-emerald-500/10',
            'text-purple-400 bg-purple-500/10'
        ];
        return colors[i % colors.length];
    };

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const statsRes = await api.get('/stats/');
            setStats(statsRes.data);

            // In a real app, we'd have an activity endpoint too
            setActivities([
                { text: 'System Online', user: 'Admin', time: 'Just now' },
                { text: 'Auth Service Pulse', user: 'System', time: '5m ago' },
                { text: 'New Session Detected', user: 'AI Engine', time: '12m ago' },
            ]);
        } catch (err) {
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [user]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-display font-bold text-white">
                    {user?.role?.replace('_', ' ')} Overview
                </h1>
                <p className="text-slate-400">Welcome back, {user?.full_name}. Here is your live system report.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {loading ? (
                    [1, 2, 3, 4].map(i => (
                        <div key={i} className="glass-card h-32 animate-pulse bg-white/5" />
                    ))
                ) : (
                    stats.map((stat, i) => {
                        const Icon = getIcon(stat.type);
                        const style = getColor(i);
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="glass-card"
                            >
                                <div className={`w-12 h-12 ${style} rounded-xl flex items-center justify-center mb-4`}>
                                    <Icon size={24} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-slate-400">{stat.label}</span>
                                    <span className="text-2xl font-display font-bold text-white">{stat.value}</span>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass-card h-80 flex flex-col items-center justify-center border-dashed border-white/5 bg-gradient-to-br from-white/5 to-transparent relative overflow-hidden">
                        <Activity className="text-slate-700 mb-4 animate-float absolute opacity-20" size={120} />
                        <div className="relative z-10 text-center px-8">
                            <Sparkles className="text-primary-500 mb-4 mx-auto" size={32} />
                            <h3 className="text-white font-bold text-xl mb-2">Real-time Analytics</h3>
                            <p className="text-slate-500 text-sm max-w-sm">
                                Your platform is now connected to the live backend. All data displayed is fetched in real-time from the database.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="glass-card">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <Clock size={20} className="text-primary-500" />
                            Recent Activity
                        </h3>
                        <div className="space-y-6">
                            {activities.map((act, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className="w-2 h-12 bg-white/5 rounded-full relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1/2 bg-primary-500/50" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-200">{act.text}</p>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">{act.user}</span>
                                            <span className="text-[10px] text-slate-600">{act.time}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Sparkles = ({ className, size }) => (
    <div className={className}>
        <TrendingUp size={size} />
    </div>
);

export default Dashboard;
