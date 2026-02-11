import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Calendar as CalendarIcon, Clock, Plus, Trash2, Link as LinkIcon, User, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const Appointments = () => {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSlotModal, setShowSlotModal] = useState(false);
    const [showBookModal, setShowBookModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);

    // Slot Form
    const [slotData, setSlotData] = useState({
        start_time: '',
        end_time: '',
        doctor_id: user?.id || ''
    });

    // Booking Form
    const [bookData, setBookData] = useState({
        patient_id: '',
        notes: ''
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [appRes, availRes] = await Promise.all([
                api.get('/appointments/'),
                api.get('/appointments/availability')
            ]);
            setAppointments(appRes.data);
            setAvailability(availRes.data);
        } catch (err) {
            toast.error('Failed to fetch scheduling data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateSlot = async (e) => {
        e.preventDefault();
        try {
            await api.post('/appointments/availability', {
                ...slotData,
                start_time: new Date(slotData.start_time).toISOString(),
                end_time: new Date(slotData.end_time).toISOString()
            });
            toast.success('Availability slot created');
            setShowSlotModal(false);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to create slot');
        }
    };

    const handleBook = async (e) => {
        e.preventDefault();
        try {
            await api.post('/appointments/book', {
                availability_id: selectedSlot.id,
                patient_id: parseInt(bookData.patient_id),
                notes: bookData.notes,
                doctor_id: selectedSlot.doctor_id,
                start_time: selectedSlot.start_time,
                end_time: selectedSlot.end_time
            });
            toast.success('Appointment booked successfully');
            setShowBookModal(false);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Booking failed');
        }
    };

    const handleDeleteSlot = async (id) => {
        if (!window.confirm('Are you sure? Linked appointments will be cancelled.')) return;
        try {
            await api.delete(`/appointments/availability/${id}`);
            toast.success('Slot removed');
            fetchData();
        } catch (err) {
            toast.error('Failed to remove slot');
        }
    }

    return (
        <div className="space-y-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white">Scheduling</h1>
                    <p className="text-slate-400">Manage doctor availability and patient bookings.</p>
                </div>
                {user?.role !== 'PATIENT' && (
                    <Button onClick={() => setShowSlotModal(true)}>
                        <Plus size={20} />
                        Add Availability
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Availability Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-white font-bold">
                        <Clock className="text-primary-500" size={20} />
                        <h2>Open Slots</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <AnimatePresence>
                            {availability.filter(s => !s.is_booked).map((slot, i) => (
                                <motion.div
                                    key={slot.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="glass-card flex flex-col justify-between group"
                                >
                                    <div>
                                        <p className="text-sm font-bold text-white mb-1">
                                            {new Date(slot.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </p>
                                        <p className="text-xs text-slate-400 flex items-center gap-1">
                                            <Clock size={12} />
                                            {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                            {new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between mt-6">
                                        <Button className="h-8 px-4 text-xs bg-white/5 hover:bg-primary-500/20" onClick={() => { setSelectedSlot(slot); setShowBookModal(true); }}>
                                            Book Now
                                        </Button>
                                        {(user?.role === 'DOCTOR' || user?.role === 'HOSPITAL') && (
                                            <button onClick={() => handleDeleteSlot(slot.id)} className="p-2 text-slate-600 hover:text-accent-500 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {availability.filter(s => !s.is_booked).length === 0 && !loading && (
                            <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-2xl">
                                <p className="text-slate-600 italic">No available slots found.</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Appointments Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 text-white font-bold">
                        <CalendarIcon className="text-accent-500" size={20} />
                        <h2>Booked Appointments</h2>
                    </div>

                    <div className="space-y-4">
                        {appointments.map((app, i) => (
                            <motion.div
                                key={app.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`glass-card relative overflow-hidden flex items-center justify-between ${app.status === 'CANCELLED' ? 'opacity-50' : ''}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 ${app.status === 'CANCELLED' ? 'text-slate-600' : 'text-primary-400'}`}>
                                        {app.status === 'CANCELLED' ? <Trash2 size={24} /> : <User size={24} />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white flex items-center gap-2">
                                            Patient #{app.patient_id}
                                            {app.status === 'CANCELLED' && <span className="text-[10px] bg-accent-500/10 text-accent-500 px-2 py-0.5 rounded-full uppercase tracking-tighter">Cancelled</span>}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {new Date(app.start_time).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                {app.status !== 'CANCELLED' && app.meet_link && (
                                    <a href={app.meet_link} target="_blank" className="p-3 bg-primary-500/10 text-primary-400 rounded-xl hover:bg-primary-500 hover:text-white transition-all">
                                        <Video size={20} />
                                    </a>
                                )}
                            </motion.div>
                        ))}
                        {appointments.length === 0 && !loading && (
                            <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-2xl">
                                <p className="text-slate-600 italic">No appointments booked yet.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Availability Modal */}
            <AnimatePresence>
                {showSlotModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm" onClick={() => setShowSlotModal(false)} />
                        <motion.div className="relative w-full max-w-md glass-card p-8">
                            <h2 className="text-2xl font-bold text-white mb-6">Create Availability</h2>
                            <form onSubmit={handleCreateSlot} className="space-y-4">
                                <Input label="Start Time" type="datetime-local" required onChange={e => setSlotData({ ...slotData, start_time: e.target.value })} />
                                <Input label="End Time" type="datetime-local" required onChange={e => setSlotData({ ...slotData, end_time: e.target.value })} />
                                <div className="flex gap-4 pt-4">
                                    <Button type="button" className="flex-1 bg-white/5" onClick={() => setShowSlotModal(false)}>Cancel</Button>
                                    <Button type="submit" className="flex-1">Create Slot</Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Book Modal */}
            <AnimatePresence>
                {showBookModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm" onClick={() => setShowBookModal(false)} />
                        <motion.div className="relative w-full max-w-md glass-card p-8">
                            <h2 className="text-2xl font-bold text-white mb-6">Book Appointment</h2>
                            <form onSubmit={handleBook} className="space-y-4">
                                <Input label="Patient ID" placeholder="Enter ID" required value={bookData.patient_id} onChange={e => setBookData({ ...bookData, patient_id: e.target.value })} />
                                <Input label="Notes" placeholder="Reason for visit" value={bookData.notes} onChange={e => setBookData({ ...bookData, notes: e.target.value })} />
                                <div className="flex gap-4 pt-4">
                                    <Button type="button" className="flex-1 bg-white/5" onClick={() => setShowBookModal(false)}>Cancel</Button>
                                    <Button type="submit" className="flex-1">Confirm Booking</Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Appointments;
