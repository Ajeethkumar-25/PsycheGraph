import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { User, Shield, Lock, Bell, Moon, Globe, LogOut, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/axios';

const Settings = () => {
    const { user, logout } = useAuth();
    const [passwordData, setPasswordData] = useState({ old: '', new: '', confirm: '' });
    const [loading, setLoading] = useState(false);

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) return toast.error('Passwords do not match');

        try {
            setLoading(true);
            await api.put(`/admin/users/${user.id}`, { password: passwordData.new });
            toast.success('Password updated successfully');
            setPasswordData({ old: '', new: '', confirm: '' });
        } catch (err) {
            toast.error('Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 max-w-4xl">
            <div>
                <h1 className="text-3xl font-display font-bold text-white">Settings</h1>
                <p className="text-slate-400">Manage your account and preferences.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Profile Section */}
                <div className="md:col-span-1 space-y-6">
                    <div className="glass-card flex flex-col items-center text-center p-8">
                        <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-accent-600 rounded-3xl flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-2xl">
                            {user?.full_name?.charAt(0)}
                        </div>
                        <h2 className="text-xl font-bold text-white">{user?.full_name}</h2>
                        <p className="text-sm text-slate-500 mb-6">{user?.email}</p>
                        <span className="px-3 py-1 bg-primary-500/10 text-primary-400 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-primary-500/20">
                            {user?.role?.replace('_', ' ')}
                        </span>
                    </div>

                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-accent-500/10 text-accent-500 hover:bg-accent-500 hover:text-white transition-all font-bold"
                    >
                        <LogOut size={20} />
                        Sign Out
                    </button>
                </div>

                {/* Main Settings */}
                <div className="md:col-span-2 space-y-6">
                    {/* Security */}
                    <div className="glass-card">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <Lock size={20} className="text-primary-500" />
                            Security & Password
                        </h3>
                        <form onSubmit={handlePasswordUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                label="New Password"
                                type="password"
                                placeholder="••••••••"
                                required
                                value={passwordData.new}
                                onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                            />
                            <Input
                                label="Confirm New Password"
                                type="password"
                                placeholder="••••••••"
                                required
                                value={passwordData.confirm}
                                onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                            />
                            <div className="sm:col-span-2 pt-4">
                                <Button type="submit" className="w-full sm:w-auto px-12" disabled={loading}>
                                    {loading ? 'Updating...' : 'Update Password'}
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Branding / Info (Visual Only) */}
                    <div className="glass-card space-y-4">
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            <ShieldCheck size={20} className="text-emerald-500" />
                            System Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-[10px] uppercase font-bold text-slate-500">Organization ID</p>
                                <p className="text-white font-mono mt-1">#{user?.organization_id || 'SYSTEM'}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-[10px] uppercase font-bold text-slate-500">API Status</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-emerald-400 text-sm font-medium">Connected</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
