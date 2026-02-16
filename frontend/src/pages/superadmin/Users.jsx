import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { User, Mail, Shield, Building2, Search, Loader2, MoreVertical, ShieldCheck, UserPlus, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';

export default function SuperAdminUsers() {
    const dispatch = useDispatch();
    const { token } = useSelector((state) => state.auth);
    const { list: organizations } = useSelector((state) => state.organizations);

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDeleting, setIsDeleting] = useState(null);

    const fetchAllUsers = async () => {
        try {
            setLoading(true);
            const response = await api.get('/users/');
            setUsers(response.data);
        } catch (error) {
            console.error('Failed to fetch users', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllUsers();
    }, []);

    const handleDeleteUser = async (user) => {
        if (!window.confirm(`Are you sure you want to delete ${user.full_name}?`)) return;

        setIsDeleting(user.id);
        try {
            // Delete user based on role - Superadmin typically deletes hospitals/admins
            const endpoint = user.role === 'HOSPITAL' ? `/admin/hospitals/${user.id}` : `/users/${user.id}`;
            await api.delete(endpoint);
            setUsers(users.filter(u => u.id !== user.id));
        } catch (error) {
            console.error('Failed to delete user', error);
            alert('Failed to delete user: ' + (error.response?.data?.detail || error.message));
        } finally {
            setIsDeleting(null);
        }
    };

    const getOrgName = (orgId) => {
        const org = organizations.find(o => o.id === orgId);
        return org ? org.name : 'Platform Global';
    };

    const filteredUsers = users.filter(user =>
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Platform Users</h2>
                    <p className="text-sm text-slate-500">Manage administrative access across all organizations</p>
                </div>
                <button className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 whitespace-nowrap">
                    <UserPlus size={20} />
                    Create Global Admin
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 transition-all font-medium text-slate-900"
                    />
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100 whitespace-nowrap">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Organization</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center">
                                        <Loader2 className="animate-spin text-primary-600 mx-auto" size={32} />
                                    </td>
                                </tr>
                            ) : filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                                                {user.full_name[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{user.full_name}</p>
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                                    <Mail size={12} />
                                                    {user.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg ${user.role === 'SUPER_ADMIN' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'}`}>
                                                <Shield size={14} />
                                            </div>
                                            <span className="text-sm font-semibold text-slate-700 capitalize">
                                                {user.role?.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                            <Building2 size={14} className="text-slate-400" />
                                            {getOrgName(user.organization_id)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase ring-1 ring-inset ring-emerald-600/20">
                                            <ShieldCheck className="h-3 w-3" />
                                            Verified
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDeleteUser(user)}
                                            disabled={isDeleting === user.id}
                                            title="Delete User"
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            {isDeleting === user.id ? (
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
        </div>
    );
}
