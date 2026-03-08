import { useEffect, useState, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAppointments, createAppointment, deleteAppointment, createAvailability, rescheduleAppointment } from '../../store/slices/AppointmentSlice';
import { fetchPatients, updatePatient } from '../../store/slices/PatientSlice';
import { fetchUsers } from '../../store/slices/AllUserSlice';
import { Plus, Calendar as CalendarIcon, Clock, Trash2, X, Loader2, ChevronRight, CheckCircle2, User, ChevronLeft, Stethoscope, MapPin, Wallet, Video, Building, Search, Edit2, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import api from '../../services/api';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Global Local Date Helper (YYYY-MM-DD)
const getLocalDateStr = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper for Time Slot
function TimeSlotButton({ time, selectedTime, onClick, isBooked }) {
    const isSelected = selectedTime === time;
    return (
        <button
            type="button"
            onClick={() => !isBooked && onClick(time)}
            disabled={isBooked}
            className={cn(
                "px-2 py-2.5 rounded-xl text-sm font-bold border transition-all relative overflow-hidden",
                isBooked
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    : isSelected
                        ? "bg-primary-600 text-white border-primary-600 shadow-md transform scale-105 z-10"
                        : "bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:bg-slate-50"
            )}
            title={isBooked ? "Slot Already Booked" : ""}
        >
            <span className={isBooked ? "opacity-40 line-through decoration-slate-400" : ""}>{time}</span>
            {isBooked && (
                <div className="absolute inset-0 bg-slate-500/5 flex items-center justify-center pointer-events-none">
                </div>
            )}
        </button>
    );
}

export default function ReceptionistAppointments() {
    const dispatch = useDispatch();
    const { list: appointments, loading } = useSelector((state) => state.appointments);
    const { list: patients } = useSelector((state) => state.patients);
    const { list: users } = useSelector((state) => state.users);
    const { user: currentUser } = useSelector((state) => state.auth);

    const [filterTab, setFilterTab] = useState('All'); // 'All', 'Today', 'This Week'
    const [doctorFilter, setDoctorFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    useEffect(() => {
        console.log("Fetching Appointments, Patients, Users, and Current Profile...");
        dispatch(fetchAppointments());
        dispatch(fetchPatients());
        dispatch(fetchUsers());

        // Dynamic import to avoid dependency issues if fetchUserProfile isn't exported directly
        import('../../store/slices/AllLoginSlice').then(module => {
            if (module.fetchUserProfile) {
                dispatch(module.fetchUserProfile());
            }
        });
    }, [dispatch]);


    const doctors = useMemo(() => {
        // Broad search for assigned doctors in the current user profile (handles nesting and various formats)
        const profileAssignedDoctors =
            currentUser?.assigned_doctors ||
            currentUser?.user?.assigned_doctors ||
            currentUser?.details?.assigned_doctors ||
            currentUser?.doctor?.assigned_doctors;

        if (Array.isArray(profileAssignedDoctors) && profileAssignedDoctors.length > 0) {
            return profileAssignedDoctors.map((d) => {
                // The `id` in assigned_doctors is the junction table ID (e.g., 1, 2, 3), not the doctor's actual ID!
                // We MUST find the doctor in the global users array by their name to get their true `id`.
                const searchName = (d.full_name || d.name || "").toLowerCase().replace(/^dr\.?\s+/i, "").trim();

                const matchingUser = users.find(u => {
                    if (u.role !== 'DOCTOR' && !u.is_doctor) return false;
                    const uName = (u.full_name || u.name || "").toLowerCase().replace(/^dr\.?\s+/i, "").trim();
                    return uName === searchName || String(u.id) === String(d.id) || String(u.user_id) === String(d.id);
                });

                // If found, use their true global user ID, otherwise fallback to the junction ID (which will likely fail but at least it won't crash)
                const realDoctorId = matchingUser?.id || matchingUser?.user_id || d.id;

                return {
                    id: String(realDoctorId),
                    full_name: matchingUser?.full_name || d.full_name || d.name || "Unknown Doctor",
                    role: 'DOCTOR'
                };
            });
        }

        // Fallback for singular assigned doctor if relevant
        const singleDoctorId = currentUser?.doctor_id || currentUser?.user?.doctor_id || currentUser?.user_id;
        const singleDoctorName = currentUser?.doctor_name || currentUser?.user?.doctor_name;
        if (singleDoctorId) {
            return [{
                id: String(singleDoctorId),
                full_name: singleDoctorName || "Assigned Doctor",
                role: 'DOCTOR'
            }];
        }

        // Strictly return NO doctors if no assignments are found, rather than falling back to global list.
        // This ensures receptionists only work with their specific assigned doctors.
        return [];
    }, [users, currentUser]);

    const filteredAppointments = useMemo(() => {
        // Initial filter: only show appointments for doctors that the receptionist is assigned to
        const doctorIds = new Set(doctors.map(d => String(d.id)));
        let filtered = appointments.filter(app => doctorIds.has(String(app.doctor_id)));

        // Ensure we have names even if the backend returns raw IDs
        filtered = filtered.map(app => {
            const patient = patients.find(p => String(p.id) === String(app.patient_id));
            const doctor = doctors.find(d => String(d.id) === String(app.doctor_id));
            return {
                ...app,
                patient_name: app.patient_name || patient?.full_name || 'Patient',
                doctor_name: app.doctor_name || doctor?.full_name || (app.doctor_id ? `Doctor #${app.doctor_id}` : 'Assigned Doctor')
            };
        });

        // Tab Filtering
        const now = new Date();
        const todayStr = getLocalDateStr(now);

        if (filterTab === 'Today') {
            filtered = filtered.filter(app => {
                const localAppDateStr = getLocalDateStr(app.start_time);
                return localAppDateStr === todayStr;
            });
        } else if (filterTab === 'This Week') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0); // Reset to start of Sunday

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7); // Include Saturday and Sunday
            endOfWeek.setHours(23, 59, 59, 999);

            filtered = filtered.filter(app => {
                const appDate = new Date(app.start_time);
                return appDate >= startOfWeek && appDate <= endOfWeek;
            });
        }

        // Doctor Filtering
        if (doctorFilter !== 'All') {
            filtered = filtered.filter(app => String(app.doctor_id) === String(doctorFilter));
        }

        // Search Filtering
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(app =>
                app.patient_name?.toLowerCase().includes(term) ||
                app.doctor_name?.toLowerCase().includes(term)
            );
        }

        return filtered.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    }, [appointments, filterTab, doctorFilter, searchTerm, patients, doctors]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterTab, doctorFilter, searchTerm]);

    // Modal & Form State (restored/maintained from original)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState(1);
    const [visitType, setVisitType] = useState('Hospital');
    const [availableDates, setAvailableDates] = useState([]);
    const [formData, setFormData] = useState({
        patient_id: '',
        doctor_id: '',
        date: '',
        time: '',
        notes: '',
        meet_link: ''
    });
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState(null);

    // Pagination indices
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredAppointments.slice(indexOfFirstItem, indexOfLastItem);

    useEffect(() => {
        const dates = [];
        const today = new Date();
        for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const localDateStr = getLocalDateStr(d);

            dates.push({
                dateObj: d,
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNumber: d.getDate(),
                fullDate: localDateStr,
                month: d.toLocaleDateString('en-US', { month: 'short' })
            });
        }
        setAvailableDates(dates);
        if (!formData.date) setFormData(prev => ({ ...prev, date: dates[0].fullDate }));
    }, []);

    const [selectedDoctor, setSelectedDoctor] = useState(null);

    // Derived state for selected doctor card
    useEffect(() => {
        if (formData.doctor_id) {
            const doc = doctors.find(d => String(d.id) === String(formData.doctor_id));
            setSelectedDoctor(doc);
        } else {
            setSelectedDoctor(null);
        }
    }, [formData.doctor_id, doctors]);

    // Auto-select doctor if exactly one is assigned to the receptionist
    useEffect(() => {
        if (isModalOpen && !isRescheduling && doctors.length === 1 && !formData.doctor_id) {
            setFormData(prev => ({ ...prev, doctor_id: String(doctors[0].id) }));
        }
    }, [doctors, isModalOpen, isRescheduling, formData.doctor_id]);
    const handleNextStep = () => {
        if (step === 1 && formData.patient_id && formData.doctor_id) {
            setStep(2);
        }
    };

    const handlePrevStep = () => {
        setStep(1);
    };

    const handlePatientChange = (patientId) => {
        const selectedPatient = patients.find(p => String(p.id) === String(patientId));
        setFormData(prev => ({
            ...prev,
            patient_id: patientId,
            // Auto-select the patient's assigned doctor if they are in the receptionist's assigned list
            doctor_id: selectedPatient?.doctor_id && doctors.some(d => String(d.id) === String(selectedPatient.doctor_id))
                ? String(selectedPatient.doctor_id)
                : (doctors.length === 1 ? String(doctors[0].id) : prev.doctor_id)
        }));
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setStep(1);
        setIsRescheduling(false);
        setEditingAppointment(null);
        setFormData({ patient_id: '', doctor_id: '', date: availableDates[0]?.fullDate || '', time: '', notes: '', meet_link: '' });
    };

    const handleEditClick = (app) => {
        setEditingAppointment(app);
        setIsRescheduling(true);
        setFormData({
            patient_id: String(app.patient_id),
            doctor_id: String(app.doctor_id),
            date: getLocalDateStr(app.start_time),
            time: new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            notes: app.notes || '',
            meet_link: app.meet_link || ''
        });
        setVisitType(app.meet_link ? 'Video' : 'Hospital');
        setStep(2); // Jump directly to slot selection
        setIsModalOpen(true);
    };

    // Track booked slots for selected doctor on the selected date
    const bookedTimeSlots = useMemo(() => {
        if (!formData.date || !formData.doctor_id) return new Set();

        const booked = new Set();
        const selectedDate = formData.date;
        const selectedDocId = String(formData.doctor_id);

        appointments.forEach(app => {
            if (String(app.doctor_id) !== selectedDocId) return;
            if (app.status?.toUpperCase() === 'CANCELLED') return;

            const localAppDateStr = getLocalDateStr(app.start_time);
            if (localAppDateStr === selectedDate) {
                const appDate = new Date(app.start_time);
                const hours = appDate.getHours().toString().padStart(2, '0');
                const minutes = appDate.getMinutes().toString().padStart(2, '0');
                booked.add(`${hours}:${minutes}`);
            }
        });
        return booked;
    }, [appointments, formData.date, formData.doctor_id]);

    // Dynamic time slots
    const timeSlots = useMemo(() => {
        const morning = [];
        const afternoon = [];
        const evening = [];

        const now = new Date();
        const todayStr = getLocalDateStr(now);

        const isToday = formData.date === todayStr;
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const addSlot = (h, list) => {
            [0, 30].forEach(m => {
                const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                if (!isToday || (h * 60 + m > currentHour * 60 + currentMinute + 15)) {
                    list.push(timeStr);
                }
            });
        };

        for (let h = 9; h < 12; h++) addSlot(h, morning);
        for (let h = 13; h < 17; h++) addSlot(h, afternoon);
        for (let h = 18; h < 21; h++) addSlot(h, evening);

        return { morning, afternoon, evening };
    }, [formData.date]);

    const handleSubmitAppointment = async (e) => {
        if (e) e.preventDefault();
        if (!formData.date || !formData.time) {
            alert("Please select a date and time slot.");
            return;
        }

        setIsSubmitting(true);
        try {
            // Correctly parse local date and time
            const [year, month, day] = formData.date.split('-').map(Number);
            const [hours, minutes] = formData.time.split(':').map(Number);

            const startDateTime = new Date(year, month - 1, day, hours, minutes);
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

            if (isRescheduling && editingAppointment) {
                // First create a new availability slot for the new time
                const slotPayload = {
                    doctor_id: parseInt(formData.doctor_id),
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString()
                };

                const orgIdValue = currentUser?.organization_id || currentUser?.user?.organization_id;
                if (orgIdValue) {
                    slotPayload.organization_id = parseInt(orgIdValue);
                }

                console.log('Creating availability with payload:', slotPayload);
                const slot = await dispatch(createAvailability(slotPayload)).unwrap();

                // Now reschedule using the new slot ID
                const reschedulePayload = {
                    new_availability_id: slot.id
                };

                console.log('Rescheduling with payload:', reschedulePayload);
                await dispatch(rescheduleAppointment({
                    id: editingAppointment.id,
                    data: reschedulePayload
                })).unwrap();
                alert('Appointment rescheduled successfully!');
            } else {
                const slotPayload = {
                    doctor_id: parseInt(formData.doctor_id),
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString()
                };

                const orgIdValue = currentUser?.organization_id || currentUser?.user?.organization_id;
                if (orgIdValue) {
                    slotPayload.organization_id = parseInt(orgIdValue);
                }

                console.log('Creating availability with payload:', slotPayload);
                const slot = await dispatch(createAvailability(slotPayload)).unwrap();

                const bookingPayload = {
                    patient_id: parseInt(formData.patient_id),
                    doctor_id: parseInt(formData.doctor_id),
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    notes: formData.notes,
                    meet_link: visitType === 'Video' ? formData.meet_link : null,
                    availability_id: slot.id
                };

                console.log('Booking appointment with payload:', bookingPayload);
                await dispatch(createAppointment(bookingPayload)).unwrap();

                // Update patient with the assigned doctor ID
                const selectedPatient = patients.find(p => String(p.id) === String(formData.patient_id));
                if (selectedPatient) {
                    const updatePayload = {
                        full_name: selectedPatient.full_name,
                        email: selectedPatient.email,
                        contact_number: selectedPatient.contact_number,
                        gender: selectedPatient.gender,
                        address: selectedPatient.address,
                        date_of_birth: selectedPatient.date_of_birth ? new Date(selectedPatient.date_of_birth).toISOString().split('T')[0] : null,
                        doctor_id: parseInt(formData.doctor_id),
                        age: selectedPatient.age || 0
                    };
                    try {
                        console.log('Updating patient with payload:', updatePayload);
                        await dispatch(updatePatient({ id: selectedPatient.id, data: updatePayload })).unwrap();
                    } catch (err) {
                        console.error("Failed to update patient with doctor_id", err);
                    }
                }

                alert('Appointment booked successfully!');
            }

            closeModal();
            dispatch(fetchAppointments()); // Refresh list
            dispatch(fetchPatients()); // Refresh patients list
        } catch (err) {
            console.error('Failed to submit appointment:', err);
            const errorMsg = typeof err === 'object' ? JSON.stringify(err) : err;
            alert(`Failed: ${errorMsg}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusStyle = (status) => {
        switch (status?.toUpperCase()) {
            case 'COMPLETED': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'SCHEDULED':
            case 'CONFIRMED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'PENDING': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'CANCELLED': return 'bg-red-50 text-red-600 border-red-100';
            case 'NO-SHOW': return 'bg-slate-100 text-slate-500 border-slate-200';
            default: return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Appointments</h1>
                    <p className="text-slate-500 mt-1 font-medium">Manage and schedule patient appointments.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-[#1b8a77] transition-all shadow-lg shadow-[#21a18c]/20"
                >
                    <CalendarIcon size={18} />
                    <span>New Appointment</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex p-1 bg-slate-100 rounded-xl w-fit border border-slate-200">
                    {['All', 'Today', 'This Week'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilterTab(tab)}
                            className={cn(
                                "px-6 py-2 text-sm font-bold rounded-lg transition-all",
                                filterTab === tab
                                    ? "bg-indigo-500 text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <select
                        value={doctorFilter}
                        onChange={(e) => setDoctorFilter(e.target.value)}
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#21a18c]/20 transition-all min-w-[200px]"
                    >
                        <option value="All">All Doctors</option>
                        {doctors.map(doc => (
                            <option key={doc.id} value={doc.id}>Dr. {doc.full_name}</option>
                        ))}
                    </select>

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#21a18c] transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Search patient..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#21a18c]/20 transition-all w-full sm:w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50">
                            <tr className="border-b border-slate-100">
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Patient</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Doctor</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {currentItems.map((app) => (
                                <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                                {app.patient_name?.[0]}
                                            </div>
                                            <span className="text-sm font-black text-slate-900">{app.patient_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-bold text-slate-500">Dr. {app.doctor_name}</span>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-500 font-bold whitespace-nowrap">
                                        {getLocalDateStr(app.start_time)}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-900 font-black">
                                        {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={cn(
                                            "px-3 py-1 text-[10px] font-black rounded-full border uppercase tracking-tighter",
                                            getStatusStyle(app.status)
                                        )}>
                                            {app.status === 'SCHEDULED' ? 'Confirmed' : app.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleEditClick(app)}
                                                className="p-2 text-slate-400 hover:text-[#21a18c] hover:bg-slate-100 rounded-lg transition-all"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            {/* <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all">
                                                <RefreshCcw size={16} />
                                            </button>
                                            <button
                                                onClick={() => dispatch(deleteAppointment(app.id))}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <X size={16} />
                                            </button> */}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination (Synced with Users.jsx style) */}
                {filteredAppointments.length > itemsPerPage && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredAppointments.length)} of {filteredAppointments.length} sessions
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            {[...Array(Math.ceil(filteredAppointments.length / itemsPerPage))].map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1
                                        ? "bg-indigo-500 text-white shadow-sm"
                                        : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-500 hover:text-indigo-500"
                                        }`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredAppointments.length / itemsPerPage)))}
                                disabled={currentPage === Math.ceil(filteredAppointments.length / itemsPerPage)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {filteredAppointments.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="p-4 rounded-full bg-slate-50 mb-4">
                            <CalendarIcon size={32} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-black text-slate-400">No appointments found</p>
                        <p className="text-xs text-slate-400 mt-1">Try changing filters or book a new session</p>
                    </div>
                )}
            </div>

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
                                        {isRescheduling ? 'Reschedule Appointment' : (step === 1 ? 'Select Patient' : 'Select Date & Time')}
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
                                                        disabled={isRescheduling}
                                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-700 appearance-none disabled:opacity-75 disabled:cursor-not-allowed"
                                                        value={formData.patient_id}
                                                        onChange={(e) => handlePatientChange(e.target.value)}
                                                    >
                                                        <option value="">Select Patient</option>
                                                        {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                                    </select>
                                                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={16} />
                                                </div>
                                            </div>

                                            {/* Doctor Select (Visible if receptionist has multiple doctors) */}
                                            {doctors.length > 1 && (
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Doctor</label>
                                                    <div className="relative group">
                                                        <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                                        <select
                                                            required
                                                            disabled={isRescheduling}
                                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-700 appearance-none disabled:opacity-75 disabled:cursor-not-allowed"
                                                            value={formData.doctor_id}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, doctor_id: e.target.value }))}
                                                        >
                                                            <option value="">Select Doctor</option>
                                                            {doctors.map(d => (
                                                                <option key={d.id} value={d.id}>Dr. {d.full_name}</option>
                                                            ))}
                                                        </select>
                                                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={16} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Doctor Card Preview (Assigned Doctor) */}
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
                                                                <p className="text-sm text-slate-500 truncate font-medium">{selectedDoctor.role === 'DOCTOR' ? 'Doctor' : ''}</p>
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
                                                                setFormData(prev => ({ ...prev, date: e.target.value }));
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 custom-scrollbar transition-all">
                                                {availableDates.map((item) => {
                                                    const isSelected = formData.date === item.fullDate;
                                                    return (
                                                        <button
                                                            key={item.fullDate}
                                                            onClick={() => setFormData(prev => ({ ...prev, date: item.fullDate }))}
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
                                                {timeSlots.morning.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                            <span>Morning</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                            {timeSlots.morning.map(time => (
                                                                <TimeSlotButton key={time} time={time} selectedTime={formData.time} isBooked={bookedTimeSlots.has(time)} onClick={(t) => setFormData(prev => ({ ...prev, time: t }))} />
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
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                            {timeSlots.afternoon.map(time => (
                                                                <TimeSlotButton key={time} time={time} selectedTime={formData.time} isBooked={bookedTimeSlots.has(time)} onClick={(t) => setFormData(prev => ({ ...prev, time: t }))} />
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
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                            {timeSlots.evening.map(time => (
                                                                <TimeSlotButton key={time} time={time} selectedTime={formData.time} isBooked={bookedTimeSlots.has(time)} onClick={(t) => setFormData(prev => ({ ...prev, time: t }))} />
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

                                            {/* Notes (Optional) */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
                                                <textarea
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-700 resize-none"
                                                    rows="2"
                                                    placeholder="Reason for visit..."
                                                    value={formData.notes}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
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
                                                                    onChange={(e) => setFormData(prev => ({ ...prev, meet_link: e.target.value }))}
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
                                            onClick={handleSubmitAppointment}
                                            disabled={isSubmitting || !formData.date || !formData.time}
                                            className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={20} />
                                                    <span>{isRescheduling ? 'Rescheduling...' : 'Confirming...'}</span>
                                                </>
                                            ) : (
                                                <span>{isRescheduling ? 'Confirm Reschedule' : 'Confirm Booking'}</span>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
// import { useEffect, useState, useRef, useMemo } from 'react';
// import { useDispatch, useSelector } from 'react-redux';
// import { fetchAppointments, createAppointment, deleteAppointment, createAvailability } from '../../store/slices/AppointmentSlice';
// import { fetchPatients } from '../../store/slices/PatientSlice';
// import { fetchUsers } from '../../store/slices/AllUserSlice';
// import { Plus, Calendar as CalendarIcon, Clock, Trash2, X, Loader2, ChevronRight, CheckCircle2, User, ChevronLeft, Stethoscope, MapPin, Wallet, Video, Building } from 'lucide-react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { clsx } from 'clsx';
// import { twMerge } from 'tailwind-merge';

// function cn(...inputs) {
//     return twMerge(clsx(inputs));
// }

// // Helper for Time Slot
// function TimeSlotButton({ time, selectedTime, onClick, isBooked }) {
//     const isSelected = selectedTime === time;
//     return (
//         <button
//             type="button"
//             onClick={() => !isBooked && onClick(time)}
//             disabled={isBooked}
//             className={cn(
//                 "px-2 py-2.5 rounded-xl text-sm font-bold border transition-all relative overflow-hidden",
//                 isBooked
//                     ? "bg-slate-100/60 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed"
//                     : isSelected
//                         ? "bg-primary-600 text-white border-primary-600 shadow-md transform scale-105 z-10"
//                         : "bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:bg-slate-50"
//             )}
//             title={isBooked ? "Slot Already Booked" : ""}
//         >
//             {time}
//         </button>
//     );
// }

// export default function ReceptionistAppointments() {
//     const dispatch = useDispatch();
//     const { list: appointments, loading } = useSelector((state) => state.appointments);
//     const { list: patients } = useSelector((state) => state.patients);
//     const { list: users } = useSelector((state) => state.users);
//     const { user: currentUser } = useSelector((state) => state.auth);

//     // Robust doctor ID and name extraction from currentUser (handles nested user object and various possible field names)
//     const assignedDoctorId = currentUser?.doctor_id || currentUser?.user?.doctor_id ||
//         currentUser?.doctor?.id || currentUser?.assigned_doctor_id ||
//         currentUser?.details?.doctor_id;

//     const assignedDoctorName = currentUser?.doctor_name || currentUser?.user?.doctor_name ||
//         currentUser?.doctor?.name || currentUser?.doctor?.full_name ||
//         currentUser?.assigned_doctor_name || currentUser?.assigned_doctor?.full_name ||
//         currentUser?.details?.doctor_name;

//     const assignedDoctorMeta = currentUser?.doctor?.qualifications || currentUser?.qualifications ||
//         currentUser?.details?.qualifications;

//     // Search for doctor name in existing appointments or general users list if not in user profile
//     const resolvedDoctorName = assignedDoctorName ||
//         appointments.find(a => String(a.doctor_id) === String(assignedDoctorId))?.doctor_name ||
//         users.find(u => String(u.id) === String(assignedDoctorId))?.full_name ||
//         users.find(u => String(u.id) === String(assignedDoctorId))?.name ||
//         (assignedDoctorId ? `Doctor #${assignedDoctorId.toString().slice(-4)}` : "Assigned Doctor");

//     const [isModalOpen, setIsModalOpen] = useState(false);
//     const [isSubmitting, setIsSubmitting] = useState(false);
//     const [step, setStep] = useState(1);
//     const [selectedDoctor, setSelectedDoctor] = useState(null);
//     const [visitType, setVisitType] = useState('Hospital');
//     const [availableDates, setAvailableDates] = useState([]);
//     const [formData, setFormData] = useState({
//         patient_id: '',
//         doctor_id: '',
//         date: '',
//         time: '',
//         notes: '',
//         meet_link: ''
//     });

//     // Show receptionist's assigned doctors directly from profile
//     const displayDoctors = useMemo(() => {
//         const assigned =
//             currentUser?.assigned_doctors ||
//             currentUser?.user?.assigned_doctors || [];

//         return assigned
//             .map(d => ({
//                 id: String(d.user_id || d.id),
//                 full_name: d.full_name || d.name || 'Unknown Doctor',
//                 role: 'DOCTOR',
//             }))
//             .sort((a, b) => a.full_name.localeCompare(b.full_name));
//     }, [currentUser]);



//     // Pagination State
//     const [currentPage, setCurrentPage] = useState(1);
//     const itemsPerPage = 6;

//     useEffect(() => {
//         dispatch(fetchAppointments());
//         dispatch(fetchPatients());
//         dispatch(fetchUsers());
//     }, [dispatch]);

//     useEffect(() => {
//         // Generate next 30 days
//         const dates = [];
//         const today = new Date();
//         for (let i = 0; i < 30; i++) {
//             const d = new Date(today);
//             d.setDate(today.getDate() + i);
//             dates.push({
//                 dateObj: d,
//                 dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
//                 dayNumber: d.getDate(),
//                 fullDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
//                 month: d.toLocaleDateString('en-US', { month: 'short' })
//             });
//         }

//         setAvailableDates(dates);
//         // Default to today if not set
//         if (!formData.date) {
//             setFormData(prev => ({ ...prev, date: dates[0].fullDate }));
//         }
//     }, []);

//     // Reset time when date changes
//     useEffect(() => {
//         setFormData(prev => ({ ...prev, time: '' }));
//     }, [formData.date]);

//     // Auto-set doctor_id based on selected patient's assigned doctor
//     useEffect(() => {
//         if (!formData.patient_id) {
//             setFormData(prev => ({ ...prev, doctor_id: '' }));
//             return;
//         }
//         const selectedPatient = patients.find(p => String(p.id) === String(formData.patient_id));
//         if (selectedPatient?.doctor_id) {
//             setFormData(prev => ({ ...prev, doctor_id: String(selectedPatient.doctor_id) }));
//         } else {
//             setFormData(prev => ({ ...prev, doctor_id: '' }));
//         }
//     }, [formData.patient_id, patients]);

//     // Derived state for selected doctor card
//     useEffect(() => {
//         if (formData.doctor_id) {
//             const doc = displayDoctors.find(d => String(d.id) === String(formData.doctor_id));
//             setSelectedDoctor(doc || null);
//         } else {
//             setSelectedDoctor(null);
//         }
//     }, [formData.doctor_id, displayDoctors]);


//     // Track booked slots for selected doctor on the selected date
//     const bookedTimeSlots = useMemo(() => {
//         if (!formData.date || !formData.doctor_id) return new Set();

//         const booked = new Set();
//         appointments.forEach(app => {
//             if (String(app.doctor_id) !== String(formData.doctor_id)) return;
//             if (app.status === 'CANCELLED') return;

//             const appDate = new Date(app.start_time);
//             // Convert start_time to local YYYY-MM-DD to match formData.date
//             const localDateStr = `${appDate.getFullYear()}-${String(appDate.getMonth() + 1).padStart(2, '0')}-${String(appDate.getDate()).padStart(2, '0')}`;

//             if (localDateStr === formData.date) {
//                 const hours = appDate.getHours().toString().padStart(2, '0');
//                 const minutes = appDate.getMinutes().toString().padStart(2, '0');
//                 booked.add(`${hours}:${minutes}`);
//             }
//         });
//         return booked;
//     }, [appointments, formData.date, formData.doctor_id]);

//     // Dynamic time slots reactive to selected date and current time
//     const timeSlots = useMemo(() => {
//         const morning = [];
//         const afternoon = [];
//         const evening = [];

//         const now = new Date();
//         const localNowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
//         const isToday = formData.date === localNowStr;
//         const currentHour = now.getHours();
//         const currentMinute = now.getMinutes();

//         const addSlot = (h, m, list) => {
//             const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
//             // If it's today, filter out past slots (with 15 min buffer)
//             if (!isToday) {
//                 list.push(timeStr);
//             } else {
//                 const slotTimeValue = h * 60 + m;
//                 const currentTimeValue = currentHour * 60 + currentMinute + 15; // 15 min buffer
//                 if (slotTimeValue > currentTimeValue) {
//                     list.push(timeStr);
//                 }
//             }
//         };

//         // Morning: 10:00 - 12:00
//         for (let h = 10; h < 12; h++) {
//             addSlot(h, 0, morning);
//             addSlot(h, 30, morning);
//         }
//         // Afternoon: 14:00 - 17:00
//         for (let h = 14; h < 17; h++) {
//             addSlot(h, 0, afternoon);
//             addSlot(h, 30, afternoon);
//         }
//         // Evening: 18:00 - 20:30
//         for (let h = 18; h < 21; h++) {
//             addSlot(h, 0, evening);
//             addSlot(h, 30, evening);
//         }

//         return { morning, afternoon, evening };
//     }, [formData.date]);

//     const handleNextStep = () => {
//         if (step === 1 && formData.patient_id && formData.doctor_id) {
//             setStep(2);
//         }
//     };

//     const handlePrevStep = () => {
//         setStep(1);
//     };

//     const handleCreateAppointment = async (e) => {
//         if (e) e.preventDefault();
//         if (!formData.date || !formData.time) {
//             alert("Please select a date and time slot.");
//             return;
//         }

//         setIsSubmitting(true);

//         // Safety check: ensure doctor_id is set
//         if (!formData.doctor_id) {
//             alert("Please select a doctor before confirming.");
//             setIsSubmitting(false);
//             return;
//         }

//         console.log("=== BOOKING SUBMIT ===");
//         console.log("formData:", JSON.stringify(formData));
//         console.log("doctor_id being used:", formData.doctor_id, "(parsed:", parseInt(formData.doctor_id), ")");
//         console.log("Resolved doctor name:", displayDoctors.find(d => d.id === formData.doctor_id)?.full_name);
//         console.log("=====================");

//         try {
//             const startDateTime = new Date(`${formData.date}T${formData.time}`);
//             const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration default

//             // 1. Create Availability Slot
//             const slotPayload = {
//                 doctor_id: parseInt(formData.doctor_id),
//                 start_time: startDateTime.toISOString(),
//                 end_time: endDateTime.toISOString()
//             };

//             console.log("Slot payload:", JSON.stringify(slotPayload));

//             const slotAction = await dispatch(createAvailability(slotPayload));

//             if (createAvailability.rejected.match(slotAction)) {
//                 throw new Error(slotAction.payload || "Failed to create time slot");
//             }

//             const slot = slotAction.payload;

//             // 2. Book Appointment
//             const selectedPatient = patients.find(p => p.id === parseInt(formData.patient_id));

//             let calcAge = null;
//             if (selectedPatient) {
//                 if (selectedPatient.patient_age) {
//                     calcAge = parseInt(selectedPatient.patient_age, 10);
//                 } else if (selectedPatient.date_of_birth) {
//                     const dob = new Date(selectedPatient.date_of_birth);
//                     if (!isNaN(dob.getTime())) {
//                         const ageDifMs = Date.now() - dob.getTime();
//                         const ageDate = new Date(ageDifMs);
//                         calcAge = Math.abs(ageDate.getUTCFullYear() - 1970);
//                     }
//                 }
//             }

//             const bookingPayload = {
//                 patient_id: parseInt(formData.patient_id),
//                 doctor_id: parseInt(formData.doctor_id),
//                 start_time: startDateTime.toISOString(),
//                 end_time: endDateTime.toISOString(),
//                 notes: formData.notes,
//                 meet_link: visitType === 'Video' ? formData.meet_link : null,
//                 availability_id: slot.id,
//                 patient_age: calcAge
//             };

//             await dispatch(createAppointment(bookingPayload)).unwrap();

//             setIsModalOpen(false);
//             setFormData(prev => ({ ...prev, patient_id: '', doctor_id: '', time: '', notes: '' }));
//             setStep(1);
//             alert('Appointment booked successfully!');
//         } catch (err) {
//             console.error('Booking failed', err);
//             alert(`Failed to book appointment: ${err.message || err}`);
//         } finally {
//             setIsSubmitting(false);
//         }
//     };

//     const handleCancel = async (id) => {
//         if (window.confirm('Cancel this appointment?')) {
//             await dispatch(deleteAppointment(id));
//         }
//     };

//     const closeModal = () => {
//         setIsModalOpen(false);
//         setStep(1);
//         setFormData(prev => ({ ...prev, patient_id: '', doctor_id: '', time: '', notes: '' }));
//     };

//     return (
//         <div className="space-y-6">
//             <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
//                 <motion.div
//                     initial={{ opacity: 0, y: -10 }}
//                     animate={{ opacity: 1, y: 0 }}
//                 >
//                     <p className="text-sm font-semibold text-indigo-600 mb-1">Scheduling</p>
//                     <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Appointments</h2>
//                     <p className="text-slate-500 mt-1">Schedule and manage clinic visits</p>
//                 </motion.div>
//                 <motion.button
//                     initial={{ opacity: 0, y: -10 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     whileHover={{ scale: 1.02 }}
//                     whileTap={{ scale: 0.98 }}
//                     onClick={() => setIsModalOpen(true)}
//                     className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 w-full sm:w-auto"
//                 >
//                     <Plus size={16} />
//                     <span>Book Appointment</span>
//                 </motion.button>
//             </div>

//             <motion.div
//                 initial={{ opacity: 0, y: 20 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ delay: 0.1 }}
//                 className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
//             >
//                 <div className="overflow-x-auto">
//                     <table className="w-full text-left">
//                         <thead className="bg-slate-50/80">
//                             <tr className="border-b border-slate-100">
//                                 <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date & Time</th>
//                                 <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</th>
//                                 <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient Age</th>
//                                 <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
//                                 <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
//                             </tr>
//                         </thead>
//                         <tbody className="divide-y divide-slate-50">
//                             {(() => {
//                                 const indexOfLastItem = currentPage * itemsPerPage;
//                                 const indexOfFirstItem = indexOfLastItem - itemsPerPage;
//                                 const currentItems = appointments.slice(indexOfFirstItem, indexOfLastItem);

//                                 return currentItems.map((app, index) => (
//                                     <motion.tr
//                                         key={app.id}
//                                         initial={{ opacity: 0 }}
//                                         animate={{ opacity: 1 }}
//                                         transition={{ delay: index * 0.03 }}
//                                         className="hover:bg-slate-50/50 transition-colors group"
//                                     >
//                                         <td className="px-6 py-4">
//                                             <div className="flex items-center gap-3">
//                                                 <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
//                                                     <CalendarIcon size={16} className="text-indigo-600" />
//                                                 </div>
//                                                 <div>
//                                                     <span className="text-sm font-semibold text-slate-900">
//                                                         {new Date(app.start_time).toLocaleDateString()}
//                                                     </span>
//                                                     <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
//                                                         <Clock size={10} />
//                                                         {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//                                                     </p>
//                                                 </div>
//                                             </div>
//                                         </td>
//                                         <td className="px-6 py-4">
//                                             <span className="text-sm font-semibold text-slate-900">{app.patient_name}</span>
//                                         </td>
//                                         <td className="px-6 py-4">
//                                             <span className="text-sm text-slate-600 font-medium">
//                                                 {app.patient_age !== null && app.patient_age !== undefined ? `${app.patient_age} Years` : 'N/A'}
//                                             </span>
//                                         </td>
//                                         <td className="px-6 py-4">
//                                             <span className={cn(
//                                                 "px-2.5 py-1 text-xs font-semibold rounded-lg",
//                                                 app.status === 'SCHEDULED' ? 'bg-blue-50 text-blue-600' :
//                                                     app.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
//                                             )}>
//                                                 {app.status}
//                                             </span>
//                                         </td>
//                                         <td className="px-6 py-4 text-right">
//                                             <button
//                                                 onClick={() => handleCancel(app.id)}
//                                                 className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
//                                             >
//                                                 <Trash2 size={16} />
//                                             </button>
//                                         </td>
//                                     </motion.tr>
//                                 ));
//                             })()}
//                         </tbody>
//                     </table>
//                 </div>

//                 {/* Pagination Controls */}
//                 {appointments.length > itemsPerPage && (
//                     <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
//                         <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
//                             Showing {Math.min((currentPage - 1) * itemsPerPage + 1, appointments.length)} to {Math.min(currentPage * itemsPerPage, appointments.length)} of {appointments.length}
//                         </div>
//                         <div className="flex items-center gap-2">
//                             <button
//                                 onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
//                                 disabled={currentPage === 1}
//                                 className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
//                             >
//                                 <ChevronLeft size={16} />
//                             </button>
//                             <div className="flex items-center gap-1">
//                                 {[...Array(Math.ceil(appointments.length / itemsPerPage))].map((_, i) => (
//                                     <button
//                                         key={i}
//                                         onClick={() => setCurrentPage(i + 1)}
//                                         className={cn(
//                                             "w-8 h-8 rounded-lg text-xs font-bold transition-all",
//                                             currentPage === i + 1
//                                                 ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
//                                                 : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
//                                         )}
//                                     >
//                                         {i + 1}
//                                     </button>
//                                 ))}
//                             </div>
//                             <button
//                                 onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(appointments.length / itemsPerPage)))}
//                                 disabled={currentPage === Math.ceil(appointments.length / itemsPerPage)}
//                                 className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
//                             >
//                                 <ChevronRight size={16} />
//                             </button>
//                         </div>
//                     </div>
//                 )}
//                 {appointments.length === 0 && !loading && (
//                     <div className="flex flex-col items-center justify-center py-16 text-center">
//                         <div className="p-4 rounded-full bg-slate-50 mb-4">
//                             <CalendarIcon size={28} className="text-slate-300" />
//                         </div>
//                         <p className="text-sm font-semibold text-slate-400">No appointments found</p>
//                         <p className="text-xs text-slate-400 mt-1">Book a new appointment to get started</p>
//                     </div>
//                 )}
//             </motion.div>

//             {/* Modal Wizard */}
//             <AnimatePresence>
//                 {isModalOpen && (
//                     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
//                         <motion.div
//                             initial={{ opacity: 0, scale: 0.95 }}
//                             animate={{ opacity: 1, scale: 1 }}
//                             exit={{ opacity: 0, scale: 0.95 }}
//                             className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
//                         >
//                             {/* Modal Header */}
//                             <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
//                                 <div className="flex items-center gap-3">
//                                     {step === 2 && (
//                                         <button onClick={handlePrevStep} className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
//                                             <ChevronLeft size={20} />
//                                         </button>
//                                     )}
//                                     <h3 className="text-lg font-bold text-slate-900">
//                                         {step === 1 ? 'Select Patient' : 'Select Date & Time'}
//                                     </h3>
//                                 </div>
//                                 <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
//                                     <X size={20} />
//                                 </button>
//                             </div>

//                             {/* Progress Bar */}
//                             <div className="h-1 bg-slate-100 w-full flex">
//                                 <motion.div
//                                     className="h-full bg-primary-500"
//                                     initial={{ width: "50%" }}
//                                     animate={{ width: step === 1 ? "50%" : "100%" }}
//                                     transition={{ duration: 0.3 }}
//                                 />
//                             </div>

//                             {/* Modal Content */}
//                             <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
//                                 <AnimatePresence mode="wait">
//                                     {step === 1 ? (
//                                         <motion.div
//                                             key="step1"
//                                             initial={{ opacity: 0, x: -20 }}
//                                             animate={{ opacity: 1, x: 0 }}
//                                             exit={{ opacity: 0, x: -20 }}
//                                             className="space-y-6"
//                                         >
//                                             {/* Patient Select */}
//                                             <div>
//                                                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Patient</label>
//                                                 <div className="relative group">
//                                                     <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
//                                                     <select
//                                                         required
//                                                         className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-700 appearance-none"
//                                                         value={formData.patient_id}
//                                                         onChange={(e) => {
//                                                             const pid = e.target.value;
//                                                             setFormData(prev => ({ ...prev, patient_id: pid }));
//                                                         }}
//                                                     >
//                                                         <option value="">Select Patient</option>
//                                                         {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
//                                                     </select>
//                                                     <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={16} />
//                                                 </div>
//                                             </div>

//                                             {/* Doctor Selection (Restored) */}
//                                             <div>
//                                                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Doctor</label>
//                                                 <div className="relative group">
//                                                     <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
//                                                     <select
//                                                         required
//                                                         className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-700 appearance-none"
//                                                         value={formData.doctor_id}
//                                                         onChange={(e) => setFormData(prev => ({ ...prev, doctor_id: e.target.value }))}
//                                                     >
//                                                         <option value="">Select Doctor</option>
//                                                         {displayDoctors.map(d => (
//                                                             <option key={d.id} value={d.id}>
//                                                                 Dr. {d.full_name}
//                                                             </option>
//                                                         ))}
//                                                     </select>
//                                                     <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={16} />
//                                                 </div>
//                                             </div>

//                                             {/* Doctor Card Preview (Assigned Doctor) */}
//                                             <AnimatePresence>
//                                                 {selectedDoctor && (
//                                                     <motion.div
//                                                         initial={{ opacity: 0, y: 10 }}
//                                                         animate={{ opacity: 1, y: 0 }}
//                                                         exit={{ opacity: 0, height: 0 }}
//                                                         className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-white to-blue-50 border border-blue-100 shadow-sm relative overflow-hidden"
//                                                     >
//                                                         <div className="flex items-start gap-4 z-10 relative">
//                                                             <div className="h-16 w-16 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl shadow-inner shrink-0">
//                                                                 {selectedDoctor.full_name?.[0]}
//                                                             </div>
//                                                             <div className="flex-1 min-w-0">
//                                                                 <h4 className="font-bold text-lg text-slate-900 truncate">Dr. {selectedDoctor.full_name}</h4>
//                                                                 <p className="text-sm text-slate-500 truncate font-medium">{selectedDoctor.role === 'DOCTOR' ? 'Doctor' : ''}</p>
//                                                                 <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
//                                                                     <span>{selectedDoctor.metadata || 'MBBS, MD • English, Hindi'}</span>
//                                                                 </div>
//                                                             </div>
//                                                         </div>

//                                                         <div className="mt-4 pt-4 border-t border-blue-100/50 flex items-center justify-between">
//                                                             <div className="flex flex-col">
//                                                                 <span className="text-xs text-slate-400 font-medium">Hospital/Clinic</span>
//                                                                 <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
//                                                                     <MapPin size={12} className="text-primary-500" />
//                                                                     PsycheGraph Main
//                                                                 </span>
//                                                             </div>
//                                                             <div className="flex flex-col items-end">
//                                                                 <span className="text-xs text-slate-400 font-medium">Fee</span>
//                                                                 <span className="text-sm font-bold text-slate-900">₹1,050</span>
//                                                             </div>
//                                                         </div>
//                                                     </motion.div>
//                                                 )}
//                                             </AnimatePresence>
//                                         </motion.div>
//                                     ) : (
//                                         <motion.div
//                                             key="step2"
//                                             initial={{ opacity: 0, x: 20 }}
//                                             animate={{ opacity: 1, x: 0 }}
//                                             exit={{ opacity: 0, x: 20 }}
//                                             className="space-y-6"
//                                         >
//                                             {/* Doctor Mini Header */}
//                                             {selectedDoctor && (
//                                                 <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
//                                                     <div className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-primary-600 font-bold text-sm">
//                                                         {selectedDoctor.full_name?.[0]}
//                                                     </div>
//                                                     <div>
//                                                         <div className="font-bold text-sm text-slate-900">Dr. {selectedDoctor.full_name}</div>

//                                                     </div>
//                                                 </div>
//                                             )}

//                                             {/* Visit Type Toggle */}
//                                             <div className="flex p-1 rounded-xl bg-slate-100/80">
//                                                 <button
//                                                     onClick={() => setVisitType('Hospital')}
//                                                     className={cn(
//                                                         "flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
//                                                         visitType === 'Hospital' ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
//                                                     )}
//                                                 >
//                                                     <Building size={16} />
//                                                     Hospital Visit
//                                                 </button>
//                                                 <button
//                                                     onClick={() => setVisitType('Video')}
//                                                     className={cn(
//                                                         "flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
//                                                         visitType === 'Video' ? "bg-white text-primary-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
//                                                     )}
//                                                 >
//                                                     <Video size={16} />
//                                                     Video Consult
//                                                 </button>
//                                             </div>

//                                             {/* Horizontal Date Selection */}
//                                             <div className="flex items-center justify-between mb-2">
//                                                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Date</label>
//                                                 <div className="flex items-center gap-2">
//                                                     <span className="text-xs font-bold text-primary-600 flex items-center gap-1">
//                                                         {new Date(formData.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
//                                                     </span>
//                                                     <button
//                                                         onClick={() => document.getElementById('date-picker-native').showPicker()}
//                                                         className="p-1.5 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors"
//                                                         title="Open Calendar"
//                                                     >
//                                                         <CalendarIcon size={14} />
//                                                     </button>
//                                                     <input
//                                                         id="date-picker-native"
//                                                         type="date"
//                                                         className="sr-only"
//                                                         value={formData.date}
//                                                         min={new Date().toISOString().split('T')[0]}
//                                                         onChange={(e) => {
//                                                             if (e.target.value) {
//                                                                 setFormData({ ...formData, date: e.target.value });
//                                                             }
//                                                         }}
//                                                     />
//                                                 </div>
//                                             </div>
//                                             <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 custom-scrollbar">
//                                                 {availableDates.map((item) => {
//                                                     const isSelected = formData.date === item.fullDate;
//                                                     return (
//                                                         <button
//                                                             key={item.fullDate}
//                                                             onClick={() => setFormData({ ...formData, date: item.fullDate })}
//                                                             className={cn(
//                                                                 "flex flex-col items-center justify-center min-w-[64px] h-[72px] rounded-2xl border transition-all shrink-0",
//                                                                 isSelected
//                                                                     ? "bg-primary-600 text-white border-primary-600 shadow-md ring-2 ring-primary-200"
//                                                                     : "bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:bg-slate-50"
//                                                             )}
//                                                         >
//                                                             <span className={cn("text-xs font-medium uppercase", isSelected ? "text-primary-100" : "text-slate-400")}>{item.dayName}</span>
//                                                             <span className="text-xl font-bold">{item.dayNumber}</span>
//                                                         </button>
//                                                     );
//                                                 })}
//                                             </div>


//                                             {/* Time Selection Grouped */}
//                                             <div className="space-y-4">
//                                                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Time</label>

//                                                 {/* Morning */}
//                                                 {timeSlots.morning.length > 0 && (
//                                                     <div>
//                                                         <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
//                                                             <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
//                                                             <span>Morning</span>
//                                                         </div>
//                                                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
//                                                             {timeSlots.morning.map(time => (
//                                                                 <TimeSlotButton key={time} time={time} selectedTime={formData.time} isBooked={bookedTimeSlots.has(time)} onClick={(t) => setFormData({ ...formData, time: t })} />
//                                                             ))}
//                                                         </div>
//                                                     </div>
//                                                 )}

//                                                 {/* Afternoon */}
//                                                 {timeSlots.afternoon.length > 0 && (
//                                                     <div>
//                                                         <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
//                                                             <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
//                                                             <span>Afternoon</span>
//                                                         </div>
//                                                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
//                                                             {timeSlots.afternoon.map(time => (
//                                                                 <TimeSlotButton key={time} time={time} selectedTime={formData.time} isBooked={bookedTimeSlots.has(time)} onClick={(t) => setFormData({ ...formData, time: t })} />
//                                                             ))}
//                                                         </div>
//                                                     </div>
//                                                 )}

//                                                 {/* Evening */}
//                                                 {timeSlots.evening.length > 0 && (
//                                                     <div>
//                                                         <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400">
//                                                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
//                                                             <span>Evening</span>
//                                                         </div>
//                                                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
//                                                             {timeSlots.evening.map(time => (
//                                                                 <TimeSlotButton key={time} time={time} selectedTime={formData.time} isBooked={bookedTimeSlots.has(time)} onClick={(t) => setFormData({ ...formData, time: t })} />
//                                                             ))}
//                                                         </div>
//                                                     </div>
//                                                 )}

//                                                 {/* No Slots Available Fallback */}
//                                                 {timeSlots.morning.length === 0 && timeSlots.afternoon.length === 0 && timeSlots.evening.length === 0 && (
//                                                     <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-slate-100 border-dashed">
//                                                         <p className="text-sm font-semibold text-slate-500">No time slots available for this date.</p>
//                                                         <p className="text-xs text-slate-400 mt-1">Please select another date</p>
//                                                     </div>
//                                                 )}
//                                             </div>

//                                             {/* Notes (Optional) */}
//                                             <div>
//                                                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
//                                                 <textarea
//                                                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-700 resize-none"
//                                                     rows="2"
//                                                     placeholder="Reason for visit..."
//                                                     value={formData.notes}
//                                                     onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
//                                                 ></textarea>
//                                             </div>

//                                             {/* Video Link (Conditional) */}
//                                             <AnimatePresence>
//                                                 {visitType === 'Video' && (
//                                                     <motion.div
//                                                         initial={{ opacity: 0, height: 0 }}
//                                                         animate={{ opacity: 1, height: 'auto' }}
//                                                         exit={{ opacity: 0, height: 0 }}
//                                                         className="overflow-hidden"
//                                                     >
//                                                         <div className="pt-2">
//                                                             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Meeting Link (Optional)</label>
//                                                             <div className="relative">
//                                                                 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
//                                                                     <Video size={16} />
//                                                                 </div>
//                                                                 <input
//                                                                     type="text"
//                                                                     className="w-full pl-11 pr-4 py-3 bg-blue-50/50 border border-blue-100 rounded-xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-700"
//                                                                     placeholder="https://meet.google.com/..."
//                                                                     value={formData.meet_link}
//                                                                     onChange={(e) => setFormData({ ...formData, meet_link: e.target.value })}
//                                                                 />
//                                                             </div>
//                                                             <p className="mt-1.5 text-[10px] text-slate-400 font-medium italic ml-1">Leave blank to generate a practice link automatically</p>
//                                                         </div>
//                                                     </motion.div>
//                                                 )}
//                                             </AnimatePresence>
//                                         </motion.div>
//                                     )}
//                                 </AnimatePresence>
//                             </div>

//                             {/* Modal Footer */}
//                             <div className="p-5 border-t border-slate-100 bg-white z-20 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] flex justify-between items-center">
//                                 {step === 1 ? (
//                                     <button
//                                         onClick={handleNextStep}
//                                         disabled={!formData.patient_id || !formData.doctor_id}
//                                         className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
//                                     >
//                                         <span>Next Step</span>
//                                         <ChevronRight size={20} />
//                                     </button>
//                                 ) : (
//                                     <div className="flex items-center justify-between w-full gap-4">
//                                         <div className="flex flex-col">
//                                             <span className="text-xs font-bold text-slate-400 uppercase">Total to Pay</span>
//                                             <span className="text-xl font-bold text-slate-900">₹1,050</span>
//                                         </div>
//                                         <button
//                                             onClick={handleCreateAppointment}
//                                             disabled={isSubmitting || !formData.date || !formData.time}
//                                             className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
//                                         >
//                                             {isSubmitting ? (
//                                                 <>
//                                                     <Loader2 className="animate-spin" size={20} />
//                                                     <span>Confirming...</span>
//                                                 </>
//                                             ) : (
//                                                 <>
//                                                     <span>Confirm Booking</span>
//                                                 </>
//                                             )}
//                                         </button>
//                                     </div>
//                                 )}
//                             </div>
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence>
//         </div>
//     );
// }