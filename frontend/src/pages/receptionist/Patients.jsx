import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPatients, createPatient, updatePatient, deletePatient } from '../../store/slices/PatientSlice';
import { fetchDoctors } from '../../store/slices/AllUserSlice';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, Users, X, Phone, Mail, Calendar, Loader2, User, ArrowUpRight, MapPin, Activity, Stethoscope, Edit3, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ReceptionistPatients() {
    const dispatch = useDispatch();
    const { user: currentUser } = useSelector((state) => state.auth);
    const { list: patients, loading: patientsLoading } = useSelector((state) => state.patients);
    const { list: allUsers, loading: usersLoading } = useSelector((state) => state.users);

    // Robust doctor ID and name extraction from currentUser (handles nested user object and various possible field names)
    const assignedDoctorId = currentUser?.doctor_id || currentUser?.user?.doctor_id ||
        currentUser?.doctor?.id || currentUser?.assigned_doctor_id ||
        currentUser?.details?.doctor_id;

    const assignedDoctorName = currentUser?.doctor_name || currentUser?.user?.doctor_name ||
        currentUser?.doctor?.name || currentUser?.doctor?.full_name ||
        currentUser?.assigned_doctor_name || currentUser?.assigned_doctor?.full_name ||
        currentUser?.details?.doctor_name;

    const assignedDoctorMeta = currentUser?.doctor?.qualifications || currentUser?.qualifications ||
        currentUser?.details?.qualifications;

    // Search for doctor name in general users list if not in user profile
    const resolvedDoctorName = assignedDoctorName ||
        allUsers.find(u => String(u.id) === String(assignedDoctorId))?.full_name ||
        allUsers.find(u => String(u.id) === String(assignedDoctorId))?.name ||
        (assignedDoctorId ? `Doctor #${assignedDoctorId.toString().slice(-4)}` : "Assigned Doctor");

    // Fallback: If doctors list is empty (due to restricted admin endpoint), 
    // we use a synthetic list containing at least the assigned doctor for selection.
    const displayDoctors = useMemo(() => {
        const doctorsList = allUsers.filter(u => u.role === 'DOCTOR');
        const list = [...doctorsList];

        if (assignedDoctorId && !list.some(d => String(d.id) === String(assignedDoctorId))) {
            list.push({
                id: assignedDoctorId,
                full_name: resolvedDoctorName,
                role: 'DOCTOR',
                metadata: assignedDoctorMeta
            });
        }
        return list;
    }, [allUsers, assignedDoctorId, resolvedDoctorName, assignedDoctorMeta]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingPatientId, setEditingPatientId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        contact_number: '',
        date_of_birth: '',
        gender: '',
        address: '',
        doctor_id: '',
        organization_id: currentUser?.organization_id || 1,
        patient_age: ''
    });

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    useEffect(() => {
        dispatch(fetchPatients());
        dispatch(fetchDoctors());
    }, [dispatch]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { organization_id, ...dataToSubmit } = formData;
            const patientPayload = {
                ...dataToSubmit,
                date_of_birth: formData.date_of_birth ? new Date(formData.date_of_birth).toISOString().split('T')[0] : null,
                doctor_id: formData.doctor_id ? parseInt(formData.doctor_id) : null,
                patient_age: formData.patient_age ? parseInt(formData.patient_age, 10) : null
            };

            if (isEditMode) {
                // Remove organization_id for updates as it might cause a 500 error
                await dispatch(updatePatient({ id: editingPatientId, data: patientPayload })).unwrap();
                alert('Patient details updated successfully');
            } else {
                await dispatch(createPatient({ ...patientPayload, organization_id: formData.organization_id })).unwrap();
                alert('Patient registered successfully');
            }

            setIsModalOpen(false);
            resetForm();
            dispatch(fetchPatients()); // Refresh list to be sure
        } catch (err) {
            console.error('Operation failed:', err);
            alert(`Failed to ${isEditMode ? 'update' : 'register'} patient`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            full_name: '',
            email: '',
            contact_number: '',
            date_of_birth: '',
            gender: '',
            address: '',
            doctor_id: '',
            organization_id: currentUser?.organization_id || 1,
            patient_age: ''
        });
        setIsEditMode(false);
        setEditingPatientId(null);
    };

    const handleEditClick = (patient) => {
        setIsEditMode(true);
        setEditingPatientId(patient.id);
        setFormData({
            full_name: patient.full_name || '',
            email: patient.email || '',
            contact_number: patient.contact_number || '',
            date_of_birth: patient.date_of_birth ? new Date(patient.date_of_birth).toISOString().split('T')[0] : '',
            gender: patient.gender || '',
            address: patient.address || '',
            doctor_id: patient.doctor_id || '',
            organization_id: patient.organization_id || currentUser?.organization_id || 1,
            patient_age: patient.patient_age || ''
        });
        setIsModalOpen(true);
    };

    const handleDeleteClick = async (patientId) => {
        if (window.confirm('Are you sure you want to delete this patient record?')) {
            try {
                await dispatch(deletePatient(patientId)).unwrap();
                alert('Patient record deleted successfully');
            } catch (err) {
                console.error('Delete failed:', err);
                alert('Failed to delete patient record');
            }
        }
    };

    const filteredPatients = patients.filter(p =>
        p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.contact_number?.includes(searchQuery)
    );

    // Reset pagination when search query changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
            >
                <div>
                    <p className="text-sm font-semibold text-indigo-600 mb-1">Patient Management</p>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Patient Registry</h2>
                    <p className="text-slate-500 mt-1">Manage patient demographics and onboarding</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 w-full sm:w-auto"
                >
                    <UserPlus size={16} />
                    <span>{isEditMode ? 'Edit Patient' : 'Register New Patient'}</span>
                </motion.button>
            </motion.div>

            {/* Search and Stats Bar */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center"
            >
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by name, email, or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
                    <Users size={16} className="text-indigo-600" />
                    <span className="text-sm font-semibold text-indigo-700">{(patients?.length || 0)} patients</span>
                </div>
            </motion.div>

            {/* Patient Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80">
                            <tr className="border-b border-slate-100">
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Birth Date</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {(() => {
                                const indexOfLastItem = currentPage * itemsPerPage;
                                const indexOfFirstItem = indexOfLastItem - itemsPerPage;
                                const currentItems = filteredPatients.slice(indexOfFirstItem, indexOfLastItem);

                                return currentItems.map((patient, index) => (
                                    <motion.tr
                                        key={patient.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: index * 0.03 }}
                                        className="hover:bg-slate-50/50 transition-colors group cursor-default"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                                                    {patient.full_name?.[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{patient.full_name}</p>
                                                    <p className="text-xs text-slate-400">{patient.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-600 flex items-center gap-1.5">
                                                <Phone size={12} className="text-slate-400" />
                                                {patient.contact_number}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-600 flex items-center gap-1.5">
                                                <Calendar size={12} className="text-slate-400" />
                                                {new Date(patient.date_of_birth).toLocaleDateString()}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-lg">
                                                Active
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEditClick(patient)}
                                                    className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                                                    title="Edit Patient"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(patient.id)}
                                                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                                                    title="Delete Patient"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ));
                            })()}
                        </tbody>
                    </table>
                </div>

                {filteredPatients.length > itemsPerPage && (
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredPatients.length)} to {Math.min(currentPage * itemsPerPage, filteredPatients.length)} of {filteredPatients.length}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="flex items-center gap-1">
                                {[...Array(Math.ceil(filteredPatients.length / itemsPerPage))].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1
                                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                            : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                                            }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredPatients.length / itemsPerPage)))}
                                disabled={currentPage === Math.ceil(filteredPatients.length / itemsPerPage)}
                                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
                {filteredPatients.length === 0 && !patientsLoading && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="p-4 rounded-full bg-slate-50 mb-4">
                            <Users size={28} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-semibold text-slate-400">
                            {searchQuery ? 'No patients match your search' : 'No patients found'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            {searchQuery ? 'Try a different search term' : 'Register a new patient to get started'}
                        </p>
                    </div>
                )}
            </motion.div>

            {/* Add Patient Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-indigo-50">
                                        <UserPlus size={18} className="text-indigo-600" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900">{isEditMode ? 'Edit Patient Details' : 'Register New Patient'}</h3>
                                </div>
                                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            required
                                            type="text"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            placeholder="ENTER PATIENT`S FULL NAME"
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            required
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="ENTER PATIENT`S EMAIL_ADDRESS"
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Contact</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                required
                                                type="tel"
                                                maxLength={10}
                                                value={formData.contact_number}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/[^0-9]/g, '');
                                                    if (value.length > 0 && !/^[6-9]/.test(value)) return;
                                                    if (value.length <= 10) {
                                                        setFormData({ ...formData, contact_number: value });
                                                    }
                                                }}
                                                placeholder="8976545686"
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date of Birth</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                required
                                                type="date"
                                                max={new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0]}
                                                value={formData.date_of_birth}
                                                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium"
                                            />
                                        </div>
                                    </div>

                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Age</label>
                                        <div className="relative">
                                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                required
                                                type="tel"
                                                value={formData.patient_age}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/[^0-9]/g, '');
                                                    setFormData({ ...formData, patient_age: value });
                                                }}
                                                placeholder="ENTER PATIENT'S AGE"
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Gender</label>
                                        <div className="relative">
                                            <Activity className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <select
                                                required
                                                value={formData.gender}
                                                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium appearance-none"
                                            >
                                                <option value="">Select Gender</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Assigned Doctor</label>
                                    <div className="relative">
                                        <Stethoscope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <select
                                            required
                                            value={formData.doctor_id}
                                            onChange={(e) => setFormData({ ...formData, doctor_id: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium appearance-none"
                                        >
                                            <option value="">Select Doctor</option>
                                            {displayDoctors.map(doc => (
                                                <option key={doc.id} value={doc.id}>
                                                    Dr. {doc.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Address</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3.5 top-3 text-slate-400" size={16} />
                                        <textarea
                                            required
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            placeholder="ENTER PATIENT`S ADDRESS"
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-400 min-h-[100px]"
                                        />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-3 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setIsModalOpen(false); resetForm(); }}
                                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 flex justify-center items-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (isEditMode ? 'Update Details' : 'Register Patient')}
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

