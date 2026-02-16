import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAppointments, createAppointment, deleteAppointment } from '../../store/slices/AppointmentSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { Calendar, Clock, Plus, X, Loader2 } from 'lucide-react';

export default function DoctorAppointments() {
    const dispatch = useDispatch();
    const { list: appointments, loading } = useSelector((state) => state.appointments);
    const { list: patients } = useSelector((state) => state.patients);
    const { user } = useSelector((state) => state.auth);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        patient_id: '',
        date: '',
        time: '',
        notes: ''
    });

    useEffect(() => {
        dispatch(fetchAppointments());
        dispatch(fetchPatients());
    }, [dispatch]);

    const handleCreate = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const startDateTime = new Date(`${formData.date}T${formData.time}`);
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

            await dispatch(createAppointment({
                patient_id: parseInt(formData.patient_id),
                doctor_id: user.id, // Assign to self
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                notes: formData.notes
            })).unwrap();
            setIsModalOpen(false);
            setFormData({ patient_id: '', date: '', time: '', notes: '' });
        } catch (e) {
            console.error(e);
            alert("Failed to book");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">My Schedule</h2>
                    <p className="text-slate-500">Manage appointments</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-primary-700 w-full sm:w-auto transition-all shadow-md active:scale-95"
                >
                    <Plus size={18} /> Schedule Follow-up
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-sm font-semibold border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap">Date & Time</th>
                                <th className="px-6 py-4 whitespace-nowrap">Patient</th>
                                <th className="px-6 py-4 whitespace-nowrap">Type</th>
                                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {appointments.map(app => (
                                <tr key={app.id} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-900">{new Date(app.start_time).toLocaleDateString()}</span>
                                            <span className="text-slate-500 text-xs">{new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium">{app.patient_name}</td>
                                    <td className="px-6 py-4 text-slate-500">Follow-up</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded uppercase">{app.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 flex flex-col max-h-[90vh]">
                        <div className="overflow-y-auto custom-scrollbar">
                            <h3 className="text-xl font-bold mb-4">Schedule Appointment</h3>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Patient</label>
                                    <select required className="w-full border p-2 rounded" value={formData.patient_id} onChange={e => setFormData({ ...formData, patient_id: e.target.value })}>
                                        <option value="">Select Patient</option>
                                        {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-medium mb-1">Date</label><input required type="date" className="w-full border p-2 rounded" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div>
                                    <div><label className="block text-sm font-medium mb-1">Time</label><input required type="time" className="w-full border p-2 rounded" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} /></div>
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border p-2 rounded">Cancel</button>
                                    <button type="submit" disabled={isSubmitting} className="flex-1 bg-primary-600 text-white p-2 rounded">Book</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
