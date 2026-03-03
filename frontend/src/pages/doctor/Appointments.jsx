import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAppointments, createAppointment, deleteAppointment, rescheduleAppointment } from '../../store/slices/AppointmentSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { Calendar as CalendarIcon, Clock, Plus, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

export default function DoctorAppointments() {
    const dispatch = useDispatch();
    const { list: appointments, loading } = useSelector((state) => state.appointments);
    const { list: patients } = useSelector((state) => state.patients);
    const { user } = useSelector((state) => state.auth);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [viewMode, setViewMode] = useState('Calendar View'); // Calendar or List
    const [formData, setFormData] = useState({
        patient_id: '',
        date: '',
        time: '',
        notes: ''
    });

    const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
    const [selectedAppointmentToReschedule, setSelectedAppointmentToReschedule] = useState(null);
    const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' });

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(monday.getDate() - monday.getDay() + 1); // Set to Monday of this week
        return monday;
    });

    const getWeekDays = () => {
        const days = [];
        for (let i = 0; i < 5; i++) { // Mon-Fri
            const d = new Date(currentWeekStart);
            d.setDate(currentWeekStart.getDate() + i);
            days.push({
                name: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i],
                date: d
            });
        }
        return days;
    };

    const timeSlots = [
        '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
        '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'
    ];

    const getAppointmentForSlot = (dayDate, timeStr) => {
        return appointments.find(app => {
            const appDate = new Date(app.start_time);
            if (appDate.toDateString() !== dayDate.toDateString()) return false;

            const hours = appDate.getHours();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            let hour12 = hours % 12;
            if (hour12 === 0) hour12 = 12;
            const appTimeStr = `${hour12}:00 ${ampm}`;

            return appTimeStr === timeStr;
        });
    };

    const handlePrevWeek = () => {
        const prev = new Date(currentWeekStart);
        prev.setDate(prev.getDate() - 7);
        setCurrentWeekStart(prev);
    };

    const handleNextWeek = () => {
        const next = new Date(currentWeekStart);
        next.setDate(next.getDate() + 7);
        setCurrentWeekStart(next);
    };

    
    const weekRangeString = () => {
        const end = new Date(currentWeekStart);
        end.setDate(end.getDate() + 4); // Friday
        return `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    };

    const handleDateSelect = (e) => {
        if (!e.target.value) return;
        const selected = new Date(e.target.value);
        const day = selected.getDay();
        const diff = selected.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const monday = new Date(selected.setDate(diff));
        setCurrentWeekStart(monday);
    };

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
            const selectedPatient = patients.find(p => p.id === parseInt(formData.patient_id));

            await dispatch(createAppointment({
                patient_id: parseInt(formData.patient_id),
                doctor_id: user.id, // Assign to self
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                notes: formData.notes,
                patient_age: parseInt(selectedPatient?.patient_age || 0, 10)
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

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to cancel this appointment?")) {
            try {
                await dispatch(deleteAppointment(id)).unwrap();
            } catch (e) {
                console.error(e);
                alert("Failed to cancel appointment");
            }
        }
    };

    const handleRescheduleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const startDateTime = new Date(`${rescheduleData.date}T${rescheduleData.time}`);
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
            await dispatch(rescheduleAppointment({
                id: selectedAppointmentToReschedule.id,
                data: {
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                }
            })).unwrap();
            setIsRescheduleModalOpen(false);
            setRescheduleData({ date: '', time: '' });
            setSelectedAppointmentToReschedule(null);
            dispatch(fetchAppointments());
        } catch (e) {
            console.error(e);
            alert("Failed to reschedule");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openRescheduleModal = (app) => {
        setSelectedAppointmentToReschedule(app);
        const startDate = new Date(app.start_time);
        setRescheduleData({
            date: startDate.toISOString().split('T')[0],
            time: startDate.toTimeString().slice(0, 5) // "HH:MM"
        });
        setIsRescheduleModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">My Schedule</h2>
                    <p className="text-slate-500">Manage appointments</p>
                </div>
            </div>

            <div className="space-y-6 max-w-[1400px] mx-auto pb-20 pt-4 px-4 sm:px-6 lg:px-8">
                {/* View Toggle */}
                <div className="flex gap-2 p-1 bg-slate-100/80 rounded-xl w-fit">
                    {['Calendar View', 'List View'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setViewMode(tab)}
                            className={cn(
                                "px-4 py-2 text-sm font-bold rounded-lg transition-all",
                                viewMode === tab
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                                Week View — <span className="font-semibold text-slate-600">{weekRangeString()}</span>
                            </h2>
                            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 items-center">
                                <button onClick={handlePrevWeek} className="p-1 hover:bg-white rounded-md transition-colors text-slate-500 hover:text-slate-800"><ChevronLeft size={18} /></button>
                                <div className="relative flex items-center justify-center p-1.5 hover:bg-white rounded-md transition-colors text-slate-500 hover:text-slate-800 cursor-pointer" title="Select Week">
                                    <CalendarIcon size={16} />
                                    <input
                                        type="date"
                                        onChange={handleDateSelect}
                                        value={currentWeekStart.toISOString().split('T')[0]}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    />
                                </div>
                                <button onClick={handleNextWeek} className="p-1 hover:bg-white rounded-md transition-colors text-slate-500 hover:text-slate-800"><ChevronRight size={18} /></button>
                            </div>
                        </div>
                    </div>

                    {viewMode === 'Calendar View' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr>
                                        <th className="w-24 px-4 py-4 bg-slate-100/50 text-slate-500 text-xs font-semibold border-r border-b border-slate-100">
                                            Time
                                        </th>
                                        {getWeekDays().map(day => (
                                            <th key={day.name} className="px-4 py-4 bg-slate-100/50 text-slate-500 text-xs font-semibold text-center border-r border-b border-slate-100 last:border-r-0">
                                                {day.name}
                                                <span className="font-normal text-slate-400 block mt-1">{day.date.getDate()}</span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeSlots.map((time, index) => (
                                        <tr key={time} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                                            <td className="px-4 py-4 text-xs font-medium text-slate-400 border-r border-b border-slate-100 align-top">
                                                {time}
                                            </td>
                                            {getWeekDays().map(day => {
                                                const app = getAppointmentForSlot(day.date, time);
                                                return (
                                                    <td key={`${day.name}-${time}`} className="px-2 py-3 border-r border-b border-slate-100 relative h-16 w-1/5 last:border-r-0">
                                                        {app && (
                                                            <div className="absolute inset-x-2 top-2 bottom-2 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-lg px-3 py-2 flex items-center shadow-sm cursor-pointer hover:bg-indigo-200 transition-colors truncate">
                                                                {app.patient_name || app.patient?.full_name || 'Patient'}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-slate-500 text-sm font-semibold border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 whitespace-nowrap">Patient</th>
                                            <th className="px-6 py-4 whitespace-nowrap">Date</th>
                                            <th className="px-6 py-4 whitespace-nowrap">Time</th>
                                            <th className="px-6 py-4 whitespace-nowrap">Type</th>
                                            <th className="px-6 py-4 whitespace-nowrap">Status</th>
                                            <th className="px-6 py-4 whitespace-nowrap">Reschedule</th>
                                            <th className="px-6 py-4 whitespace-nowrap">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(() => {
                                            const indexOfLastItem = currentPage * itemsPerPage;
                                            const indexOfFirstItem = indexOfLastItem - itemsPerPage;
                                            const currentItems = appointments.slice(indexOfFirstItem, indexOfLastItem);

                                            return currentItems.map(app => (
                                                <tr key={app.id} className="hover:bg-slate-50 transition">
                                                    <td className="px-6 py-4 font-medium">{app.patient_name || app.patient?.full_name || 'Unknown User'}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-slate-900">{new Date(app.start_time).toLocaleDateString()}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-slate-500">{new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500">Follow-up</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 text-xs font-bold rounded-full capitalize ${app.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                            app.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                                                'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {app.status || 'Scheduled'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button onClick={() => openRescheduleModal(app)} className="text-slate-600 hover:text-primary-600 font-medium text-sm transition-colors">Reschedule</button>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button onClick={() => handleDelete(app.id)} className="text-red-500 hover:text-red-700 font-medium text-sm transition-colors">Cancel</button>
                                                    </td>
                                                </tr>
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>

                            {appointments.length > itemsPerPage && (
                                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Showing {Math.min((currentPage - 1) * itemsPerPage + 1, appointments.length)} to {Math.min(currentPage * itemsPerPage, appointments.length)} of {appointments.length}
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
                                            {[...Array(Math.ceil(appointments.length / itemsPerPage))].map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setCurrentPage(i + 1)}
                                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1
                                                        ? "bg-primary-600 text-white shadow-md shadow-primary-200"
                                                        : "bg-white text-slate-600 border border-slate-200 hover:border-primary-300 hover:text-primary-600"
                                                        }`}
                                                >
                                                    {i + 1}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(appointments.length / itemsPerPage)))}
                                            disabled={currentPage === Math.ceil(appointments.length / itemsPerPage)}
                                            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {isModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 flex flex-col max-h-[90vh]">
                            <div className="overflow-y-auto custom-scrollbar">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold">Schedule Appointment</h3>
                                    <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                                </div>
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
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border p-2 rounded hover:bg-slate-50 transition">Cancel</button>
                                        <button type="submit" disabled={isSubmitting} className="flex-1 bg-primary-600 text-white p-2 rounded hover:bg-primary-700 transition flex items-center justify-center">
                                            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Book"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {isRescheduleModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 flex flex-col max-h-[90vh]">
                            <div className="overflow-y-auto custom-scrollbar">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold">Reschedule Appointment</h3>
                                    <button onClick={() => setIsRescheduleModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                                </div>
                                <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                                    <div>
                                        <p className="text-sm text-slate-500 mb-2">Rescheduling appointment for <strong>{selectedAppointmentToReschedule?.patient_name || selectedAppointmentToReschedule?.patient?.full_name || 'Patient'}</strong></p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium mb-1">New Date</label><input required type="date" className="w-full border p-2 rounded" value={rescheduleData.date} onChange={e => setRescheduleData({ ...rescheduleData, date: e.target.value })} /></div>
                                        <div><label className="block text-sm font-medium mb-1">New Time</label><input required type="time" className="w-full border p-2 rounded" value={rescheduleData.time} onChange={e => setRescheduleData({ ...rescheduleData, time: e.target.value })} /></div>
                                    </div>
                                    <div className="flex gap-2 pt-4">
                                        <button type="button" onClick={() => setIsRescheduleModalOpen(false)} className="flex-1 border p-2 rounded hover:bg-slate-50 transition">Cancel</button>
                                        <button type="submit" disabled={isSubmitting} className="flex-1 bg-primary-600 text-white p-2 rounded hover:bg-primary-700 transition flex items-center justify-center">
                                            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Reschedule"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
