import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPatients, deletePatient } from '../../store/slices/PatientSlice';
import { fetchAppointments, rescheduleAppointment, createAvailability, fetchUpdatedAppointments } from '../../store/slices/AppointmentSlice';
import { fetchSessions } from '../../store/slices/SessionSlice';
import { Search, PlayCircle, Trash2, FileText, Database, ChevronLeft, ChevronRight, Edit3, X, Eye, Video, Trash } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

function TimeSlotButton({ time, selectedTime, onClick, isBooked }) {
    const isSelected = selectedTime === time;
    return (
        <button
            type="button"
            onClick={() => !isBooked && onClick(time)}
            disabled={isBooked}
            className={cn(
                "px-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all relative overflow-hidden flex items-center justify-center",
                isBooked
                    ? "bg-slate-100/60 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed"
                    : isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105 z-10"
                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
            )}
            title={isBooked ? "Slot Already Booked" : ""}
        >
            {time}
        </button>
    );
}

export default function DoctorPatients() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { list: patients, loading } = useSelector((state) => state.patients);
    const { list: appointments } = useSelector((state) => state.appointments);
    const { list: sessions } = useSelector((state) => state.sessions);
    const { user } = useSelector((state) => state.auth);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All Status');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    // Reschedule Modal State
    const [rescheduleModal, setRescheduleModal] = useState({ isOpen: false, appointmentId: null, doctorId: null, patientAge: null, date: '', time: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);


    // Track booked slots for selected doctor on the selected date
    const bookedTimeSlots = useMemo(() => {
        if (!rescheduleModal.date) return new Set();

        const booked = new Set();
        appointments.forEach(app => {
            if (app.status === 'CANCELLED') return;
            // Ignore the appointment we are currently rescheduling
            if (app.id === rescheduleModal.appointmentId) return;

            const appDate = new Date(app.start_time);
            const localDateStr = `${appDate.getFullYear()}-${String(appDate.getMonth() + 1).padStart(2, '0')}-${String(appDate.getDate()).padStart(2, '0')}`;

            if (localDateStr === rescheduleModal.date) {
                const hours = appDate.getHours().toString().padStart(2, '0');
                const minutes = appDate.getMinutes().toString().padStart(2, '0');
                booked.add(`${hours}:${minutes}`);
            }
        });
        return booked;
    }, [appointments, rescheduleModal.date, rescheduleModal.appointmentId]);

    // Dynamic time slots reactive to selected date and current time
    const timeSlots = useMemo(() => {
        const morning = [];
        const afternoon = [];
        const evening = [];

        const now = new Date();
        const localNowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const isToday = rescheduleModal.date === localNowStr;
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const addSlot = (h, m, list) => {
            const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            // If it's today, filter out past slots (with 15 min buffer)
            if (!isToday) {
                list.push(timeStr);
            } else {
                const slotTimeValue = h * 60 + m;
                const currentTimeValue = currentHour * 60 + currentMinute + 15; // 15 min buffer
                if (slotTimeValue > currentTimeValue) {
                    list.push(timeStr);
                }
            }
        };

        // Morning: 10:00 - 12:00
        for (let h = 10; h < 12; h++) {
            addSlot(h, 0, morning);
            addSlot(h, 30, morning);
        }
        // Afternoon: 14:00 - 17:00
        for (let h = 14; h < 17; h++) {
            addSlot(h, 0, afternoon);
            addSlot(h, 30, afternoon);
        }
        // Evening: 18:00 - 20:30
        for (let h = 18; h < 21; h++) {
            addSlot(h, 0, evening);
            addSlot(h, 30, evening);
        }

        return { morning, afternoon, evening };
    }, [rescheduleModal.date]);

    useEffect(() => {
        dispatch(fetchPatients());
        dispatch(fetchAppointments());
        dispatch(fetchSessions());
    }, [dispatch]);

    const filteredPatients = patients.filter(patient => {
        const matchesSearch = patient.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            patient.contact_number?.includes(searchQuery);

        // As there is no explicit native status property, we are mocking Active/Discharged for UI purposes.
        // In a real app this would check `patient.status`
        const mockStatus = 'Active'; // Mocked to 'Active' as per current UI
        const matchesStatus = statusFilter === 'All Status' || mockStatus === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Reset pagination when search query changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const handleDelete = async (id) => {
        if (window.confirm('WARNING: Hard Delete.\nThis will permanently delete this patient and ALL associated sessions, notes, and appointments.\nAre you sure?')) {
            dispatch(deletePatient(id));
        }
    }

    const openRescheduleModal = (app) => {
        if (!app) return;
        const d = new Date(app.start_time);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');

        let calcAge = app.patient_age;
        if (calcAge == null) {
            const tempPatient = patients.find(p => p.id === app.patient_id || p.full_name === app.patient_name);
            if (tempPatient) {
                if (tempPatient.patient_age) {
                    calcAge = parseInt(tempPatient.patient_age, 10);
                } else if (tempPatient.date_of_birth) {
                    const dob = new Date(tempPatient.date_of_birth);
                    if (!isNaN(dob.getTime())) {
                        const ageDifMs = Date.now() - dob.getTime();
                        const ageDate = new Date(ageDifMs);
                        calcAge = Math.abs(ageDate.getUTCFullYear() - 1970);
                    }
                }
            }
        }

        setRescheduleModal({
            isOpen: true,
            appointmentId: app.id,
            doctorId: app.doctor_id || user?.id,
            patientAge: calcAge,
            date: `${yyyy}-${mm}-${dd}`,
            time: `${hh}:${min}`
        });
    };

    const handleReschedule = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const startDateTime = new Date(`${rescheduleModal.date}T${rescheduleModal.time}`);
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // Assuming 1 hr

            // Reschedule Appointment - Simplified payload matching existing standard patterns
            await dispatch(rescheduleAppointment({
                id: rescheduleModal.appointmentId,
                data: {
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString()
                }
            })).unwrap();

            setRescheduleModal({ isOpen: false, appointmentId: null, doctorId: null, patientAge: null, date: '', time: '' });
            dispatch(fetchUpdatedAppointments()); // Use updated endpoint as requested
        } catch (error) {
            console.error('Failed to reschedule:', error);
            alert(`Failed to reschedule: ${error.message || 'Please try again.'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">My Patients</h2>
                    <p className="text-slate-500">Manage your assigned cases</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Table Header Controls */}
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50">
                    <div className="relative w-full sm:w-[400px] group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Search size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search patients..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full sm:w-36 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-no-repeat bg-[position:right_1rem_center]"
                        >
                            <option value="All Status">All Status</option>
                            <option value="Active">Active</option>
                            <option value="Discharged">Discharged</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-sm font-semibold border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Patient Name</th>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Age</th>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Email</th>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Time</th>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Status</th>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Meet Link</th>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Notes</th>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(() => {
                                const indexOfLastItem = currentPage * itemsPerPage;
                                const indexOfFirstItem = indexOfLastItem - itemsPerPage;
                                const currentItems = filteredPatients.slice(indexOfFirstItem, indexOfLastItem);

                                return currentItems.map(patient => {
                                    const nextApp = appointments
                                        .filter(a => {
                                            const matchesPatient = String(a.patient_id) === String(patient.id) || a.patient_name === patient.full_name;
                                            const isActive = a.status === 'SCHEDULED' || a.status === 'RESCHEDULED' || a.status === 'CONFIRMED' || !a.status;
                                            return matchesPatient && isActive;
                                        })
                                        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];

                                    return (
                                        <tr key={patient.id} className="hover:bg-slate-50 transition">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
                                                        {patient.full_name[0]}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900">{patient.full_name}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-600 font-medium">
                                                    {patient.age || patient.patient_age || (patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : '--')}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-600 font-medium">
                                                    {patient.email || '--'}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-600 font-bold">
                                                    {nextApp?.start_time
                                                        ? `${new Date(nextApp.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date(nextApp.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                        : '--'}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold">
                                                    Active
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {nextApp && nextApp.meet_link ? (
                                                    <a
                                                        href={nextApp.meet_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-slate-400 hover:text-indigo-600 transition-colors inline-block"
                                                        title="Join Google Meet"
                                                    >
                                                        <Video size={18} />
                                                    </a>
                                                ) : (
                                                    <span className="text-sm text-slate-400">--</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => navigate('/doctor/soap-notes')}
                                                    className="text-indigo-600 hover:text-indigo-700 transition-colors bg-indigo-50 p-2 rounded-lg"
                                                    title="SOAP Notes"
                                                >
                                                    <FileText size={18} />
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => nextApp && openRescheduleModal(nextApp)}
                                                        disabled={!nextApp}
                                                        className={cn(
                                                            "transition-colors p-2 rounded-lg border",
                                                            nextApp
                                                                ? "text-indigo-600 hover:text-indigo-700 bg-indigo-50 border-indigo-100 hover:border-indigo-200"
                                                                : "text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed"
                                                        )}
                                                        title={nextApp ? "Reschedule Appointment" : "No active appointment found"}
                                                    >
                                                        <Edit3 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                });
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
                {filteredPatients.length === 0 && !loading && (
                    <div className="p-12 text-center text-slate-500">
                        <div className="h-16 w-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            {searchQuery ? <Search size={32} /> : <Database size={32} />}
                        </div>
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                            {searchQuery ? 'No Match Found' : 'No patients assigned to you yet.'}
                        </p>
                    </div>
                )}
            </div>

            {/* Reschedule Modal */}
            {rescheduleModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-6 flex flex-col relative max-h-[90vh]">
                        <button
                            onClick={() => setRescheduleModal({ isOpen: false, appointmentId: null, date: '', time: '' })}
                            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Reschedule Session</h3>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <form id="rescheduleForm" onSubmit={handleReschedule} className="space-y-6">
                                {/* Date Selection */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select New Date</label>
                                    <input
                                        required
                                        type="date"
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-slate-700 bg-slate-50"
                                        value={rescheduleModal.date}
                                        onChange={e => {
                                            if (e.target.value) {
                                                setRescheduleModal(prev => ({ ...prev, date: e.target.value, time: '' }))
                                            }
                                        }}
                                    />
                                </div>

                                {/* Time Selection */}
                                <div className="space-y-4">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select New Time</label>

                                    {/* Morning */}
                                    {timeSlots.morning.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                <span>Morning</span>
                                            </div>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                {timeSlots.morning.map(time => (
                                                    <TimeSlotButton key={time} time={time} selectedTime={rescheduleModal.time} isBooked={bookedTimeSlots.has(time)} onClick={(t) => setRescheduleModal(prev => ({ ...prev, time: t }))} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Afternoon */}
                                    {timeSlots.afternoon.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
                                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                                <span>Afternoon</span>
                                            </div>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                {timeSlots.afternoon.map(time => (
                                                    <TimeSlotButton key={time} time={time} selectedTime={rescheduleModal.time} isBooked={bookedTimeSlots.has(time)} onClick={(t) => setRescheduleModal(prev => ({ ...prev, time: t }))} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Evening */}
                                    {timeSlots.evening.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                <span>Evening</span>
                                            </div>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                {timeSlots.evening.map(time => (
                                                    <TimeSlotButton key={time} time={time} selectedTime={rescheduleModal.time} isBooked={bookedTimeSlots.has(time)} onClick={(t) => setRescheduleModal(prev => ({ ...prev, time: t }))} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* No Slots Available Fallback */}
                                    {timeSlots.morning.length === 0 && timeSlots.afternoon.length === 0 && timeSlots.evening.length === 0 && (
                                        <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-slate-100 border-dashed">
                                            <p className="text-sm font-semibold text-slate-500">No time slots available for this date.</p>
                                            <p className="text-xs text-slate-400 mt-1">Please select another date</p>
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>

                        <div className="flex gap-3 pt-4 mt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setRescheduleModal({ isOpen: false, appointmentId: null, date: '', time: '' })}
                                className="flex-1 bg-white border border-slate-200 text-slate-700 p-3 rounded-xl font-bold hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="rescheduleForm"
                                disabled={isSubmitting || !rescheduleModal.time || !rescheduleModal.date}
                                className="flex-1 bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50"
                            >
                                {isSubmitting ? 'Saving...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
