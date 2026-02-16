import { useEffect, useState, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAppointments, createAppointment, deleteAppointment, createAvailability } from '../../store/slices/AppointmentSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { fetchUsers } from '../../store/slices/AllUserSlice';
import { Plus, Calendar as CalendarIcon, Clock, Trash2, X, Loader2, ChevronRight, CheckCircle2, User, ChevronLeft, Stethoscope, MapPin, Wallet, Video, Building } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Helper for Time Slot
function TimeSlotButton({ time, selectedTime, onClick }) {
    const isSelected = selectedTime === time;
    return (
        <button
            onClick={() => onClick(time)}
            className={cn(
                "px-2 py-2.5 rounded-xl text-sm font-bold border transition-all relative overflow-hidden",
                isSelected
                    ? "bg-primary-600 text-white border-primary-600 shadow-md transform scale-105 z-10"
                    : "bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:bg-slate-50"
            )}
        >
            {time}
        </button>
    );
}

export default function ReceptionistAppointments() {
    const dispatch = useDispatch();
    const { list: appointments, loading } = useSelector((state) => state.appointments);
    const { list: patients } = useSelector((state) => state.patients);
    const { list: users } = useSelector((state) => state.users);
    const { user: currentUser } = useSelector((state) => state.auth);

    // Robust doctor ID and name extraction from currentUser (handles nested user object and various possible field names)
    const assignedDoctorId = currentUser?.doctor_id || currentUser?.user?.doctor_id ||
        currentUser?.doctor?.id || currentUser?.assigned_doctor_id ||
        currentUser?.details?.doctor_id;

    const assignedDoctorName = currentUser?.doctor_name || currentUser?.user?.doctor_name ||
        currentUser?.doctor?.name || currentUser?.doctor?.full_name ||
        currentUser?.assigned_doctor_name || currentUser?.assigned_doctor?.full_name ||
        currentUser?.details?.doctor_name;

    // Fix: Only use currentUser.specialization if the user is actually a doctor. 
    // Otherwise, this field likely belongs to the receptionist (e.g. "receptionist").
    const assignedDoctorRole = currentUser?.role === 'DOCTOR' ? (currentUser?.specialization || currentUser?.details?.specialization) :
        (currentUser?.doctor?.specialization || 'General Physician');

    const assignedDoctorMeta = currentUser?.doctor?.qualifications || currentUser?.qualifications ||
        currentUser?.details?.qualifications;

    // Search for doctor name in existing appointments or general users list if not in user profile
    const resolvedDoctorName = assignedDoctorName ||
        appointments.find(a => String(a.doctor_id) === String(assignedDoctorId))?.doctor_name ||
        users.find(u => String(u.id) === String(assignedDoctorId))?.full_name ||
        users.find(u => String(u.id) === String(assignedDoctorId))?.name ||
        (assignedDoctorId ? `Doctor #${assignedDoctorId.toString().slice(-4)}` : "Assigned Doctor");

    // Fallback: If doctors list is empty (due to restricted admin endpoint), 
    // we use a synthetic list containing at least the assigned doctor.
    const displayDoctors = useMemo(() => {
        const doctors = users.filter(u => u.role === 'DOCTOR');
        const list = [...doctors];

        if (assignedDoctorId && !list.some(d => String(d.id) === String(assignedDoctorId))) {
            list.push({
                id: assignedDoctorId,
                full_name: resolvedDoctorName,
                role: 'DOCTOR',
                specialization: assignedDoctorRole,
                metadata: assignedDoctorMeta
            });
        }
        return list;
    }, [users, assignedDoctorId, resolvedDoctorName, assignedDoctorRole, assignedDoctorMeta]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState(1);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [visitType, setVisitType] = useState('Hospital'); // Hospital or Video

    // Date generation for next 14 days
    const [availableDates, setAvailableDates] = useState([]);

    const [formData, setFormData] = useState({
        patient_id: '',
        doctor_id: '',
        date: '',
        time: '',
        notes: '',
        meet_link: ''
    });

    useEffect(() => {
        dispatch(fetchAppointments());
        dispatch(fetchPatients());
        // Only fetch users if user has administrative permissions
        if (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN') {
            dispatch(fetchUsers());
        }
    }, [dispatch, currentUser?.role]);

    useEffect(() => {
        // Generate next 14 days
        const dates = [];
        const today = new Date();
        // Generate next 30 days to allow booking for next month
        for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            dates.push({
                dateObj: d,
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNumber: d.getDate(),
                fullDate: d.toISOString().split('T')[0],
                month: d.toLocaleDateString('en-US', { month: 'short' })
            });
        }
        setAvailableDates(dates);
        // Default to today if not set
        if (!formData.date) {
            setFormData(prev => ({ ...prev, date: dates[0].fullDate }));
        }
    }, []);

    useEffect(() => {
        if (isModalOpen && assignedDoctorId && !formData.doctor_id) {
            setFormData(prev => ({ ...prev, doctor_id: String(assignedDoctorId) }));
        }
    }, [isModalOpen, assignedDoctorId, formData.doctor_id]);

    // Derived state for selected doctor card
    useEffect(() => {
        if (formData.doctor_id) {
            const doc = displayDoctors.find(d => String(d.id) === String(formData.doctor_id));
            setSelectedDoctor(doc);
        } else {
            setSelectedDoctor(null);
        }
    }, [formData.doctor_id, displayDoctors]);

    // Generate time slots grouped by period
    const generateTimeSlots = () => {
        const morning = [];
        const afternoon = [];
        const evening = [];

        // Mock generation
        // Morning: 10:00 - 12:00
        for (let h = 10; h < 12; h++) {
            morning.push(`${h.toString().padStart(2, '0')}:00`);
            morning.push(`${h.toString().padStart(2, '0')}:30`);
        }
        // Afternoon: 14:00 - 16:00
        for (let h = 14; h < 17; h++) {
            afternoon.push(`${h.toString().padStart(2, '0')}:00`);
            afternoon.push(`${h.toString().padStart(2, '0')}:30`);
        }
        // Evening: 18:00 - 20:00
        for (let h = 18; h < 21; h++) {
            evening.push(`${h.toString().padStart(2, '0')}:00`);
            evening.push(`${h.toString().padStart(2, '0')}:30`);
        }

        return { morning, afternoon, evening };
    };

    const timeSlots = generateTimeSlots();

    const handleNextStep = () => {
        if (step === 1 && formData.patient_id && formData.doctor_id) {
            setStep(2);
        }
    };

    const handlePrevStep = () => {
        setStep(1);
    };

    const handleCreateAppointment = async (e) => {
        if (e) e.preventDefault();
        if (!formData.date || !formData.time) {
            alert("Please select a date and time slot.");
            return;
        }

        setIsSubmitting(true);
        try {
            const startDateTime = new Date(`${formData.date}T${formData.time}`);
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration default

            // 1. Create Availability Slot
            const slotPayload = {
                doctor_id: parseInt(formData.doctor_id),
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString()
            };

            const slotAction = await dispatch(createAvailability(slotPayload));

            if (createAvailability.rejected.match(slotAction)) {
                throw new Error(slotAction.payload || "Failed to create time slot");
            }

            const slot = slotAction.payload;

            // 2. Book Appointment
            const bookingPayload = {
                patient_id: parseInt(formData.patient_id),
                doctor_id: parseInt(formData.doctor_id),
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                notes: formData.notes,
                meet_link: visitType === 'Video' ? formData.meet_link : null,
                availability_id: slot.id
            };

            await dispatch(createAppointment(bookingPayload)).unwrap();

            setIsModalOpen(false);
            setFormData(prev => ({ ...prev, patient_id: '', doctor_id: '', time: '', notes: '' }));
            setStep(1);
            alert('Appointment booked successfully!');
        } catch (err) {
            console.error('Booking failed', err);
            alert(`Failed to book appointment: ${err.message || err}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = async (id) => {
        if (window.confirm('Cancel this appointment?')) {
            await dispatch(deleteAppointment(id));
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setStep(1);
        setFormData(prev => ({ ...prev, patient_id: '', doctor_id: '', time: '', notes: '' }));
    };

    return (
        <div className="space-y-6">
            {/* DEBUG: Temporary User Structure Display
            <div className="bg-yellow-100 p-4 rounded-lg border border-yellow-300 text-xs font-mono overflow-auto max-h-60">
                <strong>Debug Info (Please share this):</strong>
                <pre>{JSON.stringify(currentUser, null, 2)}</pre>
            </div> */}

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <p className="text-sm font-semibold text-indigo-600 mb-1">Scheduling</p>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Appointments</h2>
                    <p className="text-slate-500 mt-1">Schedule and manage clinic visits</p>
                </motion.div>
                <motion.button
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 w-full sm:w-auto"
                >
                    <Plus size={16} />
                    <span>Book Appointment</span>
                </motion.button>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80">
                            <tr className="border-b border-slate-100">
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date & Time</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Doctor</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {appointments.map((app, index) => (
                                <motion.tr
                                    key={app.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: index * 0.03 }}
                                    className="hover:bg-slate-50/50 transition-colors group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                                                <CalendarIcon size={16} className="text-indigo-600" />
                                            </div>
                                            <div>
                                                <span className="text-sm font-semibold text-slate-900">
                                                    {new Date(app.start_time).toLocaleDateString()}
                                                </span>
                                                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <Clock size={10} />
                                                    {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-semibold text-slate-900">{app.patient_name}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-slate-600 flex items-center gap-1.5">
                                            <Stethoscope size={12} className="text-slate-400" />
                                            Dr. {app.doctor_name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "px-2.5 py-1 text-xs font-semibold rounded-lg",
                                            app.status === 'SCHEDULED' ? 'bg-blue-50 text-blue-600' :
                                                app.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                        )}>
                                            {app.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleCancel(app.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {appointments.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="p-4 rounded-full bg-slate-50 mb-4">
                            <CalendarIcon size={28} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-semibold text-slate-400">No appointments found</p>
                        <p className="text-xs text-slate-400 mt-1">Book a new appointment to get started</p>
                    </div>
                )}
            </motion.div>

            {/* Modal Wizard */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    {step === 2 && (
                                        <button onClick={handlePrevStep} className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                            <ChevronLeft size={20} />
                                        </button>
                                    )}
                                    <h3 className="text-lg font-bold text-slate-900">
                                        {step === 1 ? 'Select Patient' : 'Select Date & Time'}
                                    </h3>
                                </div>
                                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-1 bg-slate-100 w-full flex">
                                <motion.div
                                    className="h-full bg-primary-500"
                                    initial={{ width: "50%" }}
                                    animate={{ width: step === 1 ? "50%" : "100%" }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                                <AnimatePresence mode="wait">
                                    {step === 1 ? (
                                        <motion.div
                                            key="step1"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="space-y-6"
                                        >
                                            {/* Patient Select */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Patient</label>
                                                <div className="relative group">
                                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                                    <select
                                                        required
                                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-700 appearance-none"
                                                        value={formData.patient_id}
                                                        onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                                                    >
                                                        <option value="">Select Patient</option>
                                                        {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                                    </select>
                                                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={16} />
                                                </div>
                                            </div>

                                            {/* Doctor Select */}

                                            {/* Doctor Card Preview */}
                                            <AnimatePresence>
                                                {selectedDoctor && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-white to-blue-50 border border-blue-100 shadow-sm relative overflow-hidden"
                                                    >
                                                        <div className="flex items-start gap-4 z-10 relative">
                                                            <div className="h-16 w-16 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl shadow-inner shrink-0">
                                                                {selectedDoctor.full_name?.[0]}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-bold text-lg text-slate-900 truncate">Dr. {selectedDoctor.full_name}</h4>
                                                                <p className="text-sm text-slate-500 truncate font-medium">{selectedDoctor.specialization || 'General Physician'}</p>
                                                                <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                                                                    <span>{selectedDoctor.metadata || 'MBBS, MD • English, Hindi'}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 pt-4 border-t border-blue-100/50 flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs text-slate-400 font-medium">Hospital/Clinic</span>
                                                                <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                                                    <MapPin size={12} className="text-primary-500" />
                                                                    PsycheGraph Main
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-xs text-slate-400 font-medium">Fee</span>
                                                                <span className="text-sm font-bold text-slate-900">₹1,050</span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="step2"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="space-y-6"
                                        >
                                            {/* Doctor Mini Header */}
                                            {selectedDoctor && (
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                                    <div className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-primary-600 font-bold text-sm">
                                                        {selectedDoctor.full_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm text-slate-900">Dr. {selectedDoctor.full_name}</div>
                                                        <div className="text-xs text-slate-500">{selectedDoctor.specialization}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Visit Type Toggle */}
                                            <div className="flex p-1 rounded-xl bg-slate-100/80">
                                                <button
                                                    onClick={() => setVisitType('Hospital')}
                                                    className={cn(
                                                        "flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                                                        visitType === 'Hospital' ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                                    )}
                                                >
                                                    <Building size={16} />
                                                    Hospital Visit
                                                </button>
                                                <button
                                                    onClick={() => setVisitType('Video')}
                                                    className={cn(
                                                        "flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                                                        visitType === 'Video' ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                                    )}
                                                >
                                                    <Video size={16} />
                                                    Video Consult
                                                </button>
                                            </div>

                                            {/* Horizontal Date Selection */}
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Date</label>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-primary-600 flex items-center gap-1">
                                                        {new Date(formData.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                                    </span>
                                                    <button
                                                        onClick={() => document.getElementById('date-picker-native').showPicker()}
                                                        className="p-1.5 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors"
                                                        title="Open Calendar"
                                                    >
                                                        <CalendarIcon size={14} />
                                                    </button>
                                                    <input
                                                        id="date-picker-native"
                                                        type="date"
                                                        className="sr-only"
                                                        value={formData.date}
                                                        min={new Date().toISOString().split('T')[0]}
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                setFormData({ ...formData, date: e.target.value });
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 custom-scrollbar">
                                                {availableDates.map((item) => {
                                                    const isSelected = formData.date === item.fullDate;
                                                    return (
                                                        <button
                                                            key={item.fullDate}
                                                            onClick={() => setFormData({ ...formData, date: item.fullDate })}
                                                            className={cn(
                                                                "flex flex-col items-center justify-center min-w-[64px] h-[72px] rounded-2xl border transition-all shrink-0",
                                                                isSelected
                                                                    ? "bg-primary-600 text-white border-primary-600 shadow-md ring-2 ring-primary-200"
                                                                    : "bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:bg-slate-50"
                                                            )}
                                                        >
                                                            <span className={cn("text-xs font-medium uppercase", isSelected ? "text-primary-100" : "text-slate-400")}>{item.dayName}</span>
                                                            <span className="text-xl font-bold">{item.dayNumber}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>


                                            {/* Time Selection Grouped */}
                                            <div className="space-y-4">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Time</label>

                                                {/* Morning */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                        <span>Morning</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                        {timeSlots.morning.map(time => (
                                                            <TimeSlotButton key={time} time={time} selectedTime={formData.time} onClick={(t) => setFormData({ ...formData, time: t })} />
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Afternoon */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                                        <span>Afternoon</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                        {timeSlots.afternoon.map(time => (
                                                            <TimeSlotButton key={time} time={time} selectedTime={formData.time} onClick={(t) => setFormData({ ...formData, time: t })} />
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Evening */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                        <span>Evening</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                        {timeSlots.evening.map(time => (
                                                            <TimeSlotButton key={time} time={time} selectedTime={formData.time} onClick={(t) => setFormData({ ...formData, time: t })} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Notes (Optional) */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
                                                <textarea
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-700 resize-none"
                                                    rows="2"
                                                    placeholder="Reason for visit..."
                                                    value={formData.notes}
                                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                ></textarea>
                                            </div>

                                            {/* Video Link (Conditional) */}
                                            <AnimatePresence>
                                                {visitType === 'Video' && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="pt-2">
                                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Meeting Link (Optional)</label>
                                                            <div className="relative">
                                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                                                    <Video size={16} />
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    className="w-full pl-11 pr-4 py-3 bg-blue-50/50 border border-blue-100 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-700"
                                                                    placeholder="https://meet.google.com/..."
                                                                    value={formData.meet_link}
                                                                    onChange={(e) => setFormData({ ...formData, meet_link: e.target.value })}
                                                                />
                                                            </div>
                                                            <p className="mt-1.5 text-[10px] text-slate-400 font-medium italic ml-1">Leave blank to generate a practice link automatically</p>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-5 border-t border-slate-100 bg-white z-20 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] flex justify-between items-center">
                                {step === 1 ? (
                                    <button
                                        onClick={handleNextStep}
                                        disabled={!formData.patient_id || !formData.doctor_id}
                                        className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                                    >
                                        <span>Next Step</span>
                                        <ChevronRight size={20} />
                                    </button>
                                ) : (
                                    <div className="flex items-center justify-between w-full gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Total to Pay</span>
                                            <span className="text-xl font-bold text-slate-900">₹1,050</span>
                                        </div>
                                        <button
                                            onClick={handleCreateAppointment}
                                            disabled={isSubmitting || !formData.date || !formData.time}
                                            className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={20} />
                                                    <span>Confirming...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Confirm Booking</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )
                }
            </AnimatePresence >
        </div >
    );
}
