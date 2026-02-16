import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPatients, createPatient, deletePatient } from '../store/slices/PatientSlice';
import { Plus, Search, MoreVertical, UserPlus, PlayCircle, Users, X, Trash2, Calendar, Phone, Mail, Loader2 } from 'lucide-react';
import SessionRecorder from '../components/SessionRecorder';

export default function Patients() {
    const dispatch = useDispatch();
    const { list: patients, loading } = useSelector((state) => state.patients);
    const { user } = useSelector((state) => state.auth);

    const [activePatientId, setActivePatientId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        contact_number: '',
        date_of_birth: '',
    });

    useEffect(() => {
        dispatch(fetchPatients());
    }, [dispatch]);

    const handleAddPatient = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // Ensure DOB is in ISO format if needed, but the backend expects datetime
            // Assuming the input type="date" provides YYYY-MM-DD
            const patientPayload = {
                ...formData,
                date_of_birth: new Date(formData.date_of_birth).toISOString(),
            };
            await dispatch(createPatient(patientPayload)).unwrap();
            setIsModalOpen(false);
            setFormData({ full_name: '', email: '', contact_number: '', date_of_birth: '' });
        } catch (err) {
            console.error('Failed to add patient:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this patient?')) {
            try {
                await dispatch(deletePatient(id)).unwrap();
            } catch (err) {
                console.error('Failed to delete patient:', err);
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative w-full md:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm transition-all"
                        placeholder="Search patients..."
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-sm font-semibold border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap">Name</th>
                                <th className="px-6 py-4 whitespace-nowrap">Contact</th>
                                <th className="px-6 py-4 whitespace-nowrap">Birth Date</th>
                                <th className="px-6 py-4 whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {patients.map((patient) => (
                                <tr key={patient.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                                                {patient.full_name[0]}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">{patient.full_name}</p>
                                                <p className="text-xs text-slate-500">{patient.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 text-sm">{patient.contact_number}</td>
                                    <td className="px-6 py-4 text-slate-600 text-sm">
                                        {new Date(patient.date_of_birth).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setActivePatientId(patient.id)}
                                                className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold"
                                            >
                                                <PlayCircle size={18} />
                                                <span>Start Session</span>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(patient.id)}
                                                className="text-slate-400 hover:text-red-600 p-2 transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {patients.length === 0 && !loading && (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-4">
                        <div className="bg-slate-50 p-4 rounded-full">
                            <Users size={32} className="text-slate-400" />
                        </div>
                        <p className="font-medium">No patients in your records yet.</p>
                    </div>
                )}
                {loading && (
                    <div className="p-12 text-center text-slate-400">Loading patients...</div>
                )}
            </div>

            {/* Add Patient Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900">Add New Patient</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAddPatient} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <Users size={18} />
                                    </div>
                                    <input
                                        required
                                        type="text"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm transition-all"
                                        placeholder="Enter patient's full name"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        required
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm transition-all"
                                        placeholder="email@example.com"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Contact</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                            <Phone size={18} />
                                        </div>
                                        <input
                                            required
                                            type="tel"
                                            value={formData.contact_number}
                                            onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                                            className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm transition-all"
                                            placeholder="1234567890"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Date of Birth</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                            <Calendar size={18} />
                                        </div>
                                        <input
                                            required
                                            type="date"
                                            value={formData.date_of_birth}
                                            onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                            className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm transition-all"
                                        />
                                    </div>
                                </div>
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
                                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Save Patient'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {activePatientId && (
                <SessionRecorder
                    patientId={activePatientId}
                    onClose={() => setActivePatientId(null)}
                />
            )}
        </div>
    );
}
