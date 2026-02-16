import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Building2, Plus, Key, MoreVertical, Search, Loader2, X, Check, ShieldAlert, Trash2 } from 'lucide-react';
import { fetchOrganizations, createOrganization, deleteOrganization } from '../../store/slices/OrgSlice';
import { motion, AnimatePresence } from 'framer-motion';

export default function Organizations() {
    const dispatch = useDispatch();
    const { list: organizations, loading } = useSelector((state) => state.organizations);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Form state
    const [formData, setFormData] = useState({ name: '', license_key: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null);

    useEffect(() => {
        dispatch(fetchOrganizations());
    }, [dispatch]);

    const handleDeleteOrg = async (org) => {
        if (!window.confirm(`Are you sure you want to delete ${org.name}? This action cannot be undone.`)) return;

        setIsDeleting(org.id);
        try {
            await dispatch(deleteOrganization(org.id)).unwrap();
        } catch (error) {
            console.error('Failed to delete organization', error);
            alert('Failed to delete organization: ' + error);
        } finally {
            setIsDeleting(null);
        }
    };

    const handleAddOrg = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await dispatch(createOrganization(formData)).unwrap();
            setIsModalOpen(false);
            setFormData({ name: '', license_key: '' });
        } catch (error) {
            alert(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredOrgs = organizations.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Organizations</h2>
                    <p className="text-sm text-slate-500">Manage clinics and platform licensing</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 whitespace-nowrap"
                >
                    <Plus size={20} />
                    Onboard New Clinic
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search organizations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 transition-all font-medium text-slate-900"
                    />
                </div>
            </div>

            {/* Organizations Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100 whitespace-nowrap">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Organization Name</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">License Key</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Created At</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && organizations.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center">
                                        <Loader2 className="animate-spin text-primary-600 mx-auto" size={32} />
                                    </td>
                                </tr>
                            ) : filteredOrgs.map((org) => (
                                <tr key={org.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                                                {org.name[0]}
                                            </div>
                                            <span className="font-bold text-slate-900">{org.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-sm text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <Key size={14} className="text-slate-400" />
                                            {org.license_key}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase ring-1 ring-inset ring-emerald-600/20">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                            Active
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {new Date(org.created_at || Date.now()).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDeleteOrg(org)}
                                            disabled={isDeleting === org.id}
                                            title="Delete Organization"
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            {isDeleting === org.id ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <Trash2 size={18} />
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Org Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900">Onboard Organization</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAddOrg} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">Organization Name</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        required
                                        type="text"
                                        placeholder="Full legal name"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">License Key Prefix</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. CLINIC-V2-ABC"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                                        value={formData.license_key}
                                        onChange={(e) => setFormData({ ...formData, license_key: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="bg-amber-50 rounded-xl p-4 flex gap-3 border border-amber-100 mt-2">
                                <ShieldAlert size={20} className="text-amber-600 shrink-0" />
                                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                    Creating an organization generates a unique environment. You will be able to manage its administrative users after creation.
                                </p>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 disabled:opacity-70"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Onboard Clinic'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
