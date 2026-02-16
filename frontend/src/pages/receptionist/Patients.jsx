import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPatients, createPatient } from '../../store/slices/PatientSlice'; // Reuse slice
import { Search, UserPlus, Users, X, Phone, Mail, Calendar, Loader2 } from 'lucide-react';

export default function ReceptionistPatients() {
    const dispatch = useDispatch();
    const { list: patients, loading } = useSelector((state) => state.patients);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        contact_number: '',
        date_of_birth: '',
        organization_id: 1 // hardcoded for now or fetch from user
    });

    useEffect(() => {
        dispatch(fetchPatients());
    }, [dispatch]);

    const handleAddPatient = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const patientPayload = {
                ...formData,
                date_of_birth: new Date(formData.date_of_birth).toISOString(),
                // organization_id typically handled by backend or user context
            };
            await dispatch(createPatient(patientPayload)).unwrap();
            setIsModalOpen(false);
            setFormData({ full_name: '', email: '', contact_number: '', date_of_birth: '' });
            alert('Patient registered successfully');
        } catch (err) {
            console.error('Failed to add patient:', err);
            alert('Failed to register patient');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Patient Registry</h2>
                    <p className="text-slate-500">Manage patient demographics and onboarding</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-all shadow-md shadow-primary-200 w-full sm:w-auto active:scale-95"
                >
                    <UserPlus size={18} />
                    <span>Register New Patient</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-sm font-semibold border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap">Name</th>
                                <th className="px-6 py-4 whitespace-nowrap">Contact</th>
                                <th className="px-6 py-4 whitespace-nowrap">Birth Date</th>
                                <th className="px-6 py-4 whitespace-nowrap">Status</th>
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
                                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded uppercase">
                                            Active
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {patients.length === 0 && !loading && (
                    <div className="p-12 text-center text-slate-500">No patients found.</div>
                )}
            </div>

            {/* Add Patient Modal - reused logic implies we could have shared component but inline is fine for speed */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900">Register New Patient</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddPatient} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Full Name</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email</label>
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Contact</label>
                                    <input
                                        required
                                        type="tel"
                                        value={formData.contact_number}
                                        onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                                        className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Date of Birth</label>
                                    <input
                                        required
                                        type="date"
                                        value={formData.date_of_birth}
                                        onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                        className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-bold hover:bg-slate-50">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 flex justify-center items-center">
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : 'Register'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
