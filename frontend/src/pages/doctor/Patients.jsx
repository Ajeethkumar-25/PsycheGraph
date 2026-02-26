import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPatients, deletePatient } from '../../store/slices/PatientSlice';
import { fetchAppointments, rescheduleAppointment, createAvailability } from '../../store/slices/AppointmentSlice';
import { Search, PlayCircle, Trash2, FileText, Database, ChevronLeft, ChevronRight, Edit3, X } from 'lucide-react';
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
    const dispatch = useDispatch();
    const { list: patients, loading } = useSelector((state) => state.patients);
    const { list: appointments } = useSelector((state) => state.appointments);
    const { user } = useSelector((state) => state.auth);
    const [searchQuery, setSearchQuery] = useState('');

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
    }, [dispatch]);

    const filteredPatients = patients.filter(patient =>
        patient.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.contact_number?.includes(searchQuery)
    );

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

            // 1. Create New Availability Slot
            const slotAction = await dispatch(createAvailability({
                doctor_id: rescheduleModal.doctorId,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString()
            }));

            if (createAvailability.rejected.match(slotAction)) {
                throw new Error(slotAction.payload || "Failed to create new time slot");
            }
            const slot = slotAction.payload;

            // 2. Reschedule Appointment
            await dispatch(rescheduleAppointment({
                id: rescheduleModal.appointmentId,
                data: {
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    new_availability_id: slot.id,
                    patient_age: rescheduleModal.patientAge
                }
            })).unwrap();

            setRescheduleModal({ isOpen: false, appointmentId: null, doctorId: null, patientAge: null, date: '', time: '' });
            dispatch(fetchAppointments()); // Fetch updated appointments list
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
                <div className="relative w-full sm:w-72 group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Search size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search name or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-sm font-semibold border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Patient Name</th>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Date of Birth</th>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Phone</th>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Session</th>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Meet Link</th>
                                <th className="px-6 py-4 whitespace-nowrap text-sm">Reschedule</th>

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
                                                <p className="text-sm text-slate-600 font-medium">{patient.date_of_birth || '--'}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-600 font-medium">{patient.contact_number || '--'}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                {nextApp ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-900 text-sm">
                                                            {new Date(nextApp.start_time).toLocaleDateString()}
                                                        </span>
                                                        <span className="text-slate-500 text-xs">
                                                            {new Date(nextApp.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-slate-400">No session</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {(nextApp && nextApp.meet_link) ? (
                                                    <a
                                                        href={nextApp.meet_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-block"
                                                        title="Join Google Meet"
                                                    >
                                                        <PlayCircle size={20} className="text-indigo-600 hover:text-indigo-800" />
                                                    </a>
                                                ) : (
                                                    <span className="text-sm text-slate-400">--</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {nextApp ? (
                                                    <button
                                                        onClick={() => openRescheduleModal(nextApp)}
                                                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                                        title="Reschedule Session"
                                                    >
                                                        <Edit3 size={16} /> Reschedule
                                                    </button>
                                                ) : (
                                                    <span className="text-sm text-slate-400">--</span>
                                                )}
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
