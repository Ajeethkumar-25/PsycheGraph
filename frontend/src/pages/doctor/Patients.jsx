import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPatients, deletePatient } from '../../store/slices/PatientSlice';
import { Search, PlayCircle, Trash2, FileText, Database } from 'lucide-react';

export default function DoctorPatients() {
    const dispatch = useDispatch();
    const { list: patients, loading } = useSelector((state) => state.patients);

    useEffect(() => {
        dispatch(fetchPatients());
    }, [dispatch]);

    const handleDelete = async (id) => {
        if (window.confirm('WARNING: Hard Delete.\nThis will permanently delete this patient and ALL associated sessions, notes, and appointments.\nAre you sure?')) {
            dispatch(deletePatient(id));
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">My Patients</h2>
                    <p className="text-slate-500">Manage your assigned cases</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-sm font-semibold border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap">Patient Name</th>
                                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                                <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {patients.map(patient => (
                                <tr key={patient.id} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
                                                {patient.full_name[0]}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">{patient.full_name}</p>
                                                <p className="text-xs text-slate-500">Last seen: --</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">Active</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => window.location.href = `/doctor/session/${patient.id}`}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg tooltip"
                                                title="Start Session"
                                            >
                                                <PlayCircle size={18} />
                                            </button>
                                            <button
                                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
                                                title="View Records"
                                            >
                                                <FileText size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(patient.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg group"
                                                title="Hard Delete"
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
                    <div className="p-12 text-center text-slate-500">
                        <Database size={48} className="mx-auto text-slate-300 mb-4" />
                        <p>No patients assigned to you yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
