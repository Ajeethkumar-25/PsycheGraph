import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Clock,
    User,
    Plus,
    Loader2,
    Search
} from 'lucide-react';
import { fetchAppointments } from '../../store/slices/AppointmentSlice';
import { fetchPatients } from '../../store/slices/PatientSlice';
import { fetchUsers } from '../../store/slices/AllUserSlice';
import api from '../../services/api';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export default function ReceptionistCalendar() {
    const dispatch = useDispatch();
    const { user: currentUser } = useSelector((state) => state.auth);
    const { list: rawAppointments, loading } = useSelector((state) => state.appointments);
    const { list: patients } = useSelector((state) => state.patients);
    const { list: users } = useSelector((state) => state.users);

    const [view, setView] = useState('Weekly'); // 'Daily', 'Weekly', 'Monthly'
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        dispatch(fetchAppointments());
        dispatch(fetchPatients());
    }, [dispatch]);

    const mappedAppointments = useMemo(() => {
        // Broad search for assigned doctors in the current user profile
        const profileAssignedDoctors =
            currentUser?.assigned_doctors ||
            currentUser?.user?.assigned_doctors ||
            currentUser?.details?.assigned_doctors ||
            currentUser?.doctor?.assigned_doctors || [];

        const assignedDoctorIds = new Set(profileAssignedDoctors.map(d => String(d.user_id || d.id)));

        return rawAppointments
            .filter(app => assignedDoctorIds.has(String(app.doctor_id)))
            .map(app => {
                const patient = patients.find(p => String(p.id) === String(app.patient_id));

                // Priority for doctor lookup: assigned_doctors from profile (robust) then fallback to all users
                const doctor = profileAssignedDoctors.find(d => String(d.user_id || d.id) === String(app.doctor_id)) ||
                    users.find(u => String(u.user_id || u.id) === String(app.doctor_id));

                return {
                    ...app,
                    patient_name: app.patient_name || patient?.full_name || 'Patient',
                    doctor_name: app.doctor_name || doctor?.full_name || (app.doctor_id ? `Doctor #${app.doctor_id}` : 'Assigned Doctor')
                };
            });
    }, [rawAppointments, patients, users, currentUser]);

    // --- Date Helpers ---

    const startOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    };

    const getDaysInWeek = (date) => {
        const start = startOfWeek(new Date(date));
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    };

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const startPadding = firstDay.getDay();
        const days = [];

        // Prev month padding
        for (let i = startPadding - 1; i >= 0; i--) {
            days.push(new Date(year, month, -i));
        }

        // Current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        // Next month padding to fill 6 weeks (42 days)
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push(new Date(year, month + 1, i));
        }

        return days;
    };

    const weekDays = useMemo(() => getDaysInWeek(currentDate), [currentDate]);
    const monthDays = useMemo(() => getDaysInMonth(currentDate), [currentDate]);
    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 to 20:00

    const formatRange = () => {
        if (view === 'Daily') {
            return currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        if (view === 'Monthly') {
            return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
        const start = weekDays[0];
        const end = weekDays[6];
        const startMonth = start.toLocaleString('default', { month: 'short' });
        const endMonth = end.toLocaleString('default', { month: 'short' });
        const year = end.getFullYear();

        if (startMonth === endMonth) {
            return `${startMonth} ${start.getDate()} — ${end.getDate()}, ${year}`;
        }
        return `${startMonth} ${start.getDate()} — ${endMonth} ${end.getDate()}, ${year}`;
    };

    const navigateDate = (direction) => {
        const newDate = new Date(currentDate);
        if (view === 'Weekly') {
            newDate.setDate(currentDate.getDate() + (direction * 7));
        } else if (view === 'Daily') {
            newDate.setDate(currentDate.getDate() + direction);
        } else if (view === 'Monthly') {
            newDate.setMonth(currentDate.getMonth() + direction);
        }
        setCurrentDate(newDate);
    };

    const resetToToday = () => {
        setCurrentDate(new Date());
    };

    // --- Renderers ---

    const renderDailyView = () => {
        const todayStr = getLocalDateStr(currentDate);
        const dayAppointments = mappedAppointments.filter(app => {
            return getLocalDateStr(app.start_time) === todayStr;
        });

        return (
            <div className="flex-1 overflow-y-auto bg-white">
                <div className="min-w-full">
                    {hours.map((hour) => {
                        const timeString = `${hour.toString().padStart(2, '0')}:00`;
                        const hourAppointments = dayAppointments.filter(app => {
                            const d = new Date(app.start_time);
                            return d.getHours() === hour;
                        });

                        return (
                            <div key={hour} className="group flex border-b border-slate-100 min-h-[100px] relative">
                                <div className="w-20 py-4 px-4 text-xs font-mono text-slate-400 border-r border-slate-50 shrink-0">
                                    {timeString}
                                </div>
                                <div className="flex-1 p-2 flex flex-wrap gap-3">
                                    {hourAppointments.map(app => (
                                        <motion.div
                                            key={app.id}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="h-fit min-w-[200px] max-w-[300px] p-3 bg-[#e8f6f3] border-l-4 border-l-[#21a18c] rounded-lg shadow-sm group/card cursor-pointer hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-[10px] font-black text-[#21a18c] uppercase">
                                                    {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <User size={12} className="text-[#21a18c]" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-900">{app.patient_name}</p>
                                            <p className="text-[11px] text-slate-500 font-medium">Dr. {app.doctor_name}</p>
                                        </motion.div>
                                    ))}
                                    {hourAppointments.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="w-[calc(100%-1rem)] h-px bg-slate-100 absolute top-1/2 left-4" />
                                            <button className="z-10 p-1.5 bg-slate-50 text-slate-300 rounded-full border border-slate-100 hover:bg-indigo-500 hover:text-white hover:border-[#21a18c] transition-all">
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderWeeklyView = () => {
        return (
            <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100 overflow-hidden">
                {weekDays.map((day, i) => {
                    const dayStr = getLocalDateStr(day);
                    const dayAppointments = mappedAppointments.filter(app => {
                        return getLocalDateStr(app.start_time) === dayStr;
                    });

                    return (
                        <div key={i} className={cn(
                            "flex flex-col min-h-0",
                            day.toDateString() === new Date().toDateString() && "bg-indigo-500/[0.02]"
                        )}>
                            {/* Subheader for week view */}
                            <div className="p-3 border-b border-slate-50 text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                                <p className={cn("text-lg font-black", day.toDateString() === new Date().toDateString() ? "text-[#21a18c]" : "text-slate-900")}>
                                    {day.getDate()}
                                </p>
                            </div>
                            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                                {dayAppointments.map(app => (
                                    <div key={app.id} className="p-2 bg-white border border-slate-100 border-l-2 border-l-[#21a18c] rounded-md shadow-sm hover:shadow-md transition-all cursor-pointer">
                                        <p className="text-[9px] font-bold text-[#21a18c]">{new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        <p className="text-[11px] font-bold text-slate-800 truncate">{app.patient_name}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderMonthlyView = () => {
        return (
            <div className="flex-1 flex flex-col min-h-0 bg-white">
                {/* Day Names Header */}
                <div className="grid grid-cols-7 border-b border-slate-100">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>
                    ))}
                </div>
                {/* Month Grid */}
                <div className="flex-1 grid grid-cols-7 grid-rows-6 divide-x divide-y divide-slate-100">
                    {monthDays.map((day, i) => {
                        const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                        const dayStr = getLocalDateStr(day);
                        const dayAppointments = mappedAppointments.filter(app => {
                            return getLocalDateStr(app.start_time) === dayStr;
                        });

                        return (
                            <div key={i} className={cn(
                                "p-1 flex flex-col min-h-0 relative group",
                                !isCurrentMonth && "bg-slate-50/50",
                                day.toDateString() === new Date().toDateString() && "bg-indigo-500/[0.02]"
                            )}>
                                <span className={cn(
                                    "text-xs font-bold p-1 w-6 h-6 flex items-center justify-center rounded-full mb-1",
                                    !isCurrentMonth ? "text-slate-300" : "text-slate-700",
                                    day.toDateString() === new Date().toDateString() && "bg-indigo-500 text-white"
                                )}>
                                    {day.getDate()}
                                </span>
                                <div className="flex-1 space-y-1 overflow-hidden">
                                    {dayAppointments.slice(0, 3).map(app => (
                                        <div key={app.id} className="px-1.5 py-0.5 bg-[#e8f6f3] text-[9px] font-bold text-[#21a18c] rounded truncate border border-[#21a18c]/10">
                                            {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {app.patient_name}
                                        </div>
                                    ))}
                                    {dayAppointments.length > 3 && (
                                        <p className="text-[9px] font-black text-slate-400 pl-1">+{dayAppointments.length - 3} more</p>
                                    )}
                                </div>
                                <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-[#21a18c] transition-opacity">
                                    <Plus size={12} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Calendar</h1>
                    <p className="text-slate-500 mt-1 font-medium">View and manage appointment schedules.</p>
                </div>

                {/* View Switcher */}
                <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200 shadow-inner">
                    {['Daily', 'Weekly', 'Monthly'].map((v) => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={cn(
                                "px-6 py-2.5 text-xs font-black rounded-xl transition-all duration-300 uppercase tracking-widest",
                                view === v
                                    ? "bg-indigo-500 text-white shadow-lg shadow-[#21a18c]/20 "
                                    : "text-slate-500 hover:text-slate-800 hover:bg-white"
                            )}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </div>

            {/* Navigation & Range */}
            <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                        <button
                            onClick={() => navigateDate(-1)}
                            className="p-2.5 hover:bg-white hover:shadow-md rounded-xl text-slate-400 hover:text-[#21a18c] transition-all transform hover:scale-105"
                        >
                            <ChevronLeft size={20} strokeWidth={3} />
                        </button>
                        <button
                            onClick={() => navigateDate(1)}
                            className="p-2.5 hover:bg-white hover:shadow-md rounded-xl text-slate-400 hover:text-[#21a18c] transition-all transform hover:scale-105"
                        >
                            <ChevronRight size={20} strokeWidth={3} />
                        </button>
                    </div>
                    <button
                        onClick={resetToToday}
                        className="px-6 py-2.5 text-xs font-black text-slate-600 hover:bg-indigo-500 hover:text-white border border-slate-100 hover:border-[#21a18c] rounded-2xl transition-all uppercase tracking-widest bg-white shadow-sm"
                    >
                        Today
                    </button>
                </div>

                <h2 className="text-2xl font-black text-slate-900 tracking-tight drop-shadow-sm">
                    {formatRange()}
                </h2>

                <div className="flex items-center gap-4">
                    <div className="relative group hidden sm:block">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#21a18c] transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Find appointment..."
                            className="pl-12 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-[#21a18c]/10 focus:border-[#21a18c] transition-all w-72 placeholder:text-slate-300"
                        />
                    </div>
                </div>
            </div>

            {/* Calendar Grid Container */}
            <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={view + currentDate.toISOString()}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 flex flex-col min-h-0"
                    >
                        {view === 'Daily' && renderDailyView()}
                        {view === 'Weekly' && renderWeeklyView()}
                        {view === 'Monthly' && renderMonthlyView()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 rounded-3xl text-white shadow-lg">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-[#21a18c]/20" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scheduled Sessions</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Video Calls</span>
                    </div>
                </div>
                {loading ? (
                    <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border border-white/10">
                        <Loader2 className="animate-spin text-[#21a18c]" size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Updating Sync...</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Server Connected</span>
                    </div>
                )}
            </div>
        </div>
    );
};