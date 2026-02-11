import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Users, Search, Plus, Trash2, Edit2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const Patients = () => {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        full_name: '',
        date_of_birth: '',
        contact_number: '',
        email: ''
    });

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const res = await api.get('/patients/');
            setPatients(res.data);
        } catch (err) {
            toast.error('Failed to fetch patients');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/patients/', formData);
            toast.success('Patient registered successfully');
            setShowModal(false);
            fetchPatients();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Registration failed');
        }
    };

    const filteredPatients = patients.filter(p =>
        p.full_name.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white">Patients</h1>
                    <p className="text-slate-400">Manage patient records and medical history.</p>
                </div>
                <Button onClick={() => setShowModal(true)}>
                    <Plus size={20} />
                    Add Patient
                </Button>
            </div>

            <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            className="w-full bg-dark-900/50 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:border-primary-500/50 outline-none"
                            placeholder="Search patients by name or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                <th className="px-6 py-4">Patient Name</th>
                                <th className="px-6 py-4">Date of Birth</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            <AnimatePresence>
                                {filteredPatients.map((p, i) => (
                                    <motion.tr
                                        key={p.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="group hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-primary-500/20 text-primary-400 flex items-center justify-center font-bold text-xs">
                                                    {p.full_name.charAt(0)}
                                                </div>
                                                <span className="font-medium text-white">{p.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{new Date(p.date_of_birth).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{p.contact_number}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{p.email || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="p-2 hover:bg-accent-500/10 rounded-lg text-accent-500 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                            {loading && (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-4 h-16 bg-white/5" />
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(false)}
                            className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg glass-card p-8"
                        >
                            <h2 className="text-2xl font-bold text-white mb-6">Register New Patient</h2>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <Input
                                    label="Full Name"
                                    required
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                />
                                <Input
                                    label="Date of Birth"
                                    type="date"
                                    required
                                    value={formData.date_of_birth}
                                    onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                                />
                                <Input
                                    label="Contact Number"
                                    required
                                    value={formData.contact_number}
                                    onChange={e => setFormData({ ...formData, contact_number: e.target.value })}
                                />
                                <Input
                                    label="Email Address"
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                                <div className="flex gap-4 pt-4">
                                    <Button type="button" className="flex-1 bg-white/5 text-white" onClick={() => setShowModal(false)}>Cancel</Button>
                                    <Button type="submit" className="flex-1">Register Patient</Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Patients;
