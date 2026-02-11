import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Building2, Users, Plus, Shield, Globe, Mail, ShieldCheck, Trash2, Edit2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const Management = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState(user?.role === 'SUPER_ADMIN' ? 'orgs' : 'users');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');

    // Form States
    const [orgForm, setOrgForm] = useState({ name: '', license_key: '' });
    const [userForm, setUserForm] = useState({
        email: '',
        password: '',
        full_name: '',
        role: 'DOCTOR',
        organization_id: user?.organization_id || ''
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const endpoint = activeTab === 'orgs' ? '/admin/organizations' : '/admin/users';
            const res = await api.get(endpoint);
            setData(res.data);
        } catch (err) {
            toast.error(`Failed to fetch ${activeTab}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const handleOrgSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/organizations', orgForm);
            toast.success('Organization created successfully');
            setShowModal(false);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to create organization');
        }
    };

    const handleUserSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/users', userForm);
            toast.success('User created successfully');
            setShowModal(false);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to create user');
        }
    };

    const filteredData = data.filter(item => {
        const term = search.toLowerCase();
        if (activeTab === 'orgs') return item.name.toLowerCase().includes(term);
        return item.full_name.toLowerCase().includes(term) || item.email.toLowerCase().includes(term);
    });

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white">Management Console</h1>
                    <p className="text-slate-400">Control system-wide entities and user access.</p>
                </div>
                <Button onClick={() => setShowModal(true)}>
                    <Plus size={20} />
                    {activeTab === 'orgs' ? 'New Organization' : 'New User'}
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-dark-900 rounded-2xl w-fit border border-white/5">
                {user?.role === 'SUPER_ADMIN' && (
                    <button
                        onClick={() => setActiveTab('orgs')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'orgs' ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                        Organizations
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                    Users
                </button>
            </div>

            <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            className="w-full bg-dark-900/50 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:border-primary-500/50 outline-none"
                            placeholder={`Search ${activeTab === 'orgs' ? 'organizations' : 'users'}...`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                {activeTab === 'orgs' ? (
                                    <>
                                        <th className="px-6 py-4">Organization Name</th>
                                        <th className="px-6 py-4">ID</th>
                                        <th className="px-6 py-4">License Key</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-4">Name & Email</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4">Organization</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredData.map((item, i) => (
                                <tr key={item.id} className="group hover:bg-white/5 transition-colors">
                                    {activeTab === 'orgs' ? (
                                        <>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3 text-white font-medium">
                                                    <Building2 size={18} className="text-primary-500" />
                                                    {item.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-400">#{item.id}</td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-500">{item.license_key}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-medium">{item.full_name}</span>
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                        <Mail size={10} /> {item.email}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${item.role === 'DOCTOR' ? 'bg-blue-500/10 text-blue-400' :
                                                    item.role === 'RECEPTIONIST' ? 'bg-purple-500/10 text-purple-400' :
                                                        'bg-amber-500/10 text-amber-400'
                                                    }`}>
                                                    {item.role.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-400">Org #{item.organization_id}</td>
                                        </>
                                    )}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400"><Edit2 size={16} /></button>
                                            <button className="p-2 hover:bg-accent-500/10 rounded-lg text-accent-500"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {loading && <div className="p-12 text-center text-slate-500">Loading records...</div>}
                    {!loading && filteredData.length === 0 && (
                        <div className="p-12 text-center text-slate-600 italic">No records found.</div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-lg glass-card p-8">
                            <h2 className="text-2xl font-bold text-white mb-6">
                                {activeTab === 'orgs' ? 'Add Organization' : 'Create New User'}
                            </h2>
                            <form onSubmit={activeTab === 'orgs' ? handleOrgSubmit : handleUserSubmit} className="space-y-4">
                                {activeTab === 'orgs' ? (
                                    <>
                                        <Input label="Organization Name" required value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} />
                                        <Input label="License Key" placeholder="ORG-XXXX-XXXX" required value={orgForm.license_key} onChange={e => setOrgForm({ ...orgForm, license_key: e.target.value })} />
                                    </>
                                ) : (
                                    <>
                                        <Input label="Full Name" required value={userForm.full_name} onChange={e => setUserForm({ ...userForm, full_name: e.target.value })} />
                                        <Input label="Email" type="email" required value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
                                        <Input label="Password" type="password" required value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} />
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-slate-400 ml-1">User Role</label>
                                            <select
                                                className="w-full input-field"
                                                value={userForm.role}
                                                onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                                            >
                                                {user?.role === 'SUPER_ADMIN' ? (
                                                    <option value="HOSPITAL">Hospital Admin</option>
                                                ) : (
                                                    <>
                                                        <option value="DOCTOR">Doctor</option>
                                                        <option value="RECEPTIONIST">Receptionist</option>
                                                    </>
                                                )}
                                            </select>
                                        </div>
                                        {user?.role === 'SUPER_ADMIN' && (
                                            <Input label="Organization ID" type="number" required value={userForm.organization_id} onChange={e => setUserForm({ ...userForm, organization_id: e.target.value })} />
                                        )}
                                    </>
                                )}
                                <div className="flex gap-4 pt-4">
                                    <Button type="button" className="flex-1 bg-white/5" onClick={() => setShowModal(false)}>Cancel</Button>
                                    <Button type="submit" className="flex-1">Confirm and Add</Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Management;
