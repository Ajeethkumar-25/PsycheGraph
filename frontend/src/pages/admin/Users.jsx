import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Pencil, Trash2, X, Check, Eye, EyeOff, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchUsers, createUser, updateUser, deleteUser, clearError } from '../../store/slices/AllUserSlice';

// Toast Component
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border ${type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
                }`}
        >
            {type === 'success' ? (
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <Check size={18} />
                </div>
            ) : (
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
                    <AlertCircle size={18} />
                </div>
            )}
            <div className="flex flex-col">
                <p className="font-bold text-sm leading-tight">{type === 'success' ? 'Success' : 'Error'}</p>
                <p className="text-xs opacity-90 font-medium mt-0.5">{message}</p>
            </div>
            <button onClick={onClose} className="ml-2 p-1 hover:bg-black/5 rounded-lg transition-colors">
                <X size={16} />
            </button>
        </motion.div>
    );
};

export default function AdminUsers() {
    const dispatch = useDispatch();
    const { user: currentUser } = useSelector((state) => state.auth);
    const { list: users, loading, error } = useSelector((state) => state.users);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [toast, setToast] = useState(null);

    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'DOCTOR',
        specialization: '',
        shift_timing: '',
        license_key: '',
        doctor_id: ''
    });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
    }, []);

    useEffect(() => {
        dispatch(fetchUsers());
        if (currentUser?.license_key) {
            setFormData(prev => ({ ...prev, license_key: currentUser.license_key }));
        }
        return () => dispatch(clearError());
    }, [dispatch, currentUser]);

    // Update form when error changes to show toast
    useEffect(() => {
        if (error) {
            showToast(typeof error === 'string' ? error : 'An error occurred', 'error');
            dispatch(clearError());
        }
    }, [error, showToast, dispatch]);

    const handleOpenModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                full_name: user.full_name,
                email: user.email,
                password: '',
                role: user.role,
                specialization: user.specialization || '',
                shift_timing: user.shift_timing || '',
                license_key: user.license_key || currentUser?.license_key || '',
                doctor_id: user.doctor_id || ''
            });
        } else {
            setEditingUser(null);
            setFormData({
                full_name: '',
                email: '',
                password: '',
                role: 'DOCTOR',
                specialization: '',
                shift_timing: '',
                license_key: currentUser?.license_key || '',
                doctor_id: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
        dispatch(clearError());
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic validation
        if (!formData.email || !formData.full_name || (!editingUser && !formData.password) || (!editingUser && !formData.license_key)) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        const payload = { ...formData };
        if (editingUser && !payload.password) {
            delete payload.password; // Don't send empty password on update
        }

        // For Receptionists, ensure doctor_id is an integer if provided
        if (payload.role === 'RECEPTIONIST' && payload.doctor_id) {
            payload.doctor_id = parseInt(payload.doctor_id);
        }

        let result;
        if (editingUser) {
            result = await dispatch(updateUser({
                id: editingUser.id,
                data: payload,
                role: editingUser.role
            }));
            if (!result.error) showToast('User updated successfully');
        } else {
            // Backend schemas for Doctor/Receptionist registration REQUIRE specialization (and shift_timing for recep)
            if (!payload.specialization) payload.specialization = "General";
            if (payload.role === 'RECEPTIONIST' && !payload.shift_timing) payload.shift_timing = "General";

            // Strip fields not allowed by backend schemas (organization_id is derived from license_key)
            const { role, organization_id, ...cleanPayload } = payload;

            // For Doctors, strip shift_timing and doctor_id
            if (role === 'DOCTOR') {
                delete cleanPayload.shift_timing;
                delete cleanPayload.doctor_id;
            }

            result = await dispatch(createUser({
                role: role,
                userData: cleanPayload
            }));
            if (!result.error) showToast('User created successfully');
        }

        if (!result.error) {
            dispatch(fetchUsers());
            handleCloseModal();
        }
    };

    const handleDelete = async (id, role) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            const result = await dispatch(deleteUser({ id, role }));
            if (!result.error) {
                showToast('User deleted successfully');
                dispatch(fetchUsers()); // Refresh list to be sure
            }
        }
    };

    return (
        <div className="space-y-6">
            <AnimatePresence>
                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
            </AnimatePresence>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
                    <p className="text-slate-500">Manage doctors and receptionists</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 w-full md:w-auto font-bold"
                >
                    <Plus size={20} />
                    Add User
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                                <th className="px-6 py-4 whitespace-nowrap">Name</th>
                                <th className="px-6 py-4 whitespace-nowrap">Email</th>
                                <th className="px-6 py-4 whitespace-nowrap">Role/Specialization</th>
                                <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500 font-medium">
                                        <div className="flex flex-col items-center gap-2 py-4">
                                            <Info size={32} className="text-slate-300" />
                                            <p>No users found. Click "Add User" to create one.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/80 transition group">
                                        <td className="px-6 py-4 font-bold text-slate-900">{user.full_name}</td>
                                        <td className="px-6 py-4 text-slate-600 font-medium font-mono text-sm">{user.email}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={`w-fit px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm border ${user.role === 'DOCTOR' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    user.role === 'RECEPTIONIST' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                        'bg-slate-50 text-slate-700 border-slate-100'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                                {user.specialization && (
                                                    <span className="text-xs text-slate-400 font-bold ml-1">
                                                        {user.specialization}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenModal(user);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                    title="Edit User"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(user.id, user.role);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Delete User"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleCloseModal}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
                        >
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editingUser ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {editingUser ? <Pencil size={20} /> : <Plus size={20} />}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900">{editingUser ? 'Edit User Profile' : 'Register New User'}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{editingUser ? 'Update Information' : 'Enter Details Below'}</p>
                                    </div>
                                </div>
                                <button onClick={handleCloseModal} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                                        <input
                                            type="text"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                                            placeholder="Dr. John Doe"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                                            placeholder="doctor@clinic.com"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                                            {editingUser ? 'New Password (Optional)' : 'Password'}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 pr-12"
                                                placeholder="••••••••"
                                                required={!editingUser}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">License Key</label>
                                        <input
                                            type="text"
                                            value={formData.license_key}
                                            readOnly={!!editingUser}
                                            onChange={(e) => setFormData({ ...formData, license_key: e.target.value })}
                                            className={`w-full px-4 py-2.5 border rounded-xl outline-none transition-all font-bold ${editingUser ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-700'}`}
                                            placeholder="Enter organization license key"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Role</label>
                                        <select
                                            disabled={!!editingUser}
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value, specialization: e.target.value === 'RECEPTIONIST' ? '' : formData.specialization })}
                                            className={`w-full px-4 py-2.5 border rounded-xl outline-none transition-all font-bold ${editingUser ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-700'}`}
                                        >
                                            <option value="DOCTOR">Doctor</option>
                                            <option value="RECEPTIONIST">Receptionist</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Specialization</label>
                                        <input
                                            type="text"
                                            value={formData.specialization}
                                            onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                                            placeholder="e.g. Cardiologist"
                                        />
                                    </div>
                                    {formData.role === 'RECEPTIONIST' && (
                                        <>
                                            <div className="col-span-2">
                                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Assigned Doctor</label>
                                                <select
                                                    required
                                                    value={formData.doctor_id || ''}
                                                    onChange={(e) => setFormData({ ...formData, doctor_id: e.target.value })}
                                                    className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-emerald-900"
                                                >
                                                    <option value="">Select a Doctor</option>
                                                    {users.filter(u => u.role === 'DOCTOR').map(doctor => (
                                                        <option key={doctor.id} value={doctor.id}>
                                                            {doctor.full_name} ({doctor.specialization || 'General'})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Shift Timing</label>
                                                <input
                                                    type="text"
                                                    value={formData.shift_timing}
                                                    onChange={(e) => setFormData({ ...formData, shift_timing: e.target.value })}
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                                                    placeholder="e.g. 9 AM - 5 PM"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="flex-1 px-4 py-3 border-2 border-slate-100 text-slate-400 rounded-xl hover:bg-slate-50 hover:text-slate-600 hover:border-slate-200 font-bold tracking-wider uppercase text-xs transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-[2] px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed font-black tracking-widest uppercase text-xs transition-all flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (editingUser ? 'Update User Information' : 'Register New User')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
