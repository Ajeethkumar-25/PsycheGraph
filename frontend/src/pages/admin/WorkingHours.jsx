import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    Calendar,
    Save,
    CheckCircle2,
    AlertTriangle,
    ChevronRight
} from 'lucide-react';

export default function WorkingHours() {
    const [schedule, setSchedule] = useState({
        Monday: { isOpen: true, start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
        Tuesday: { isOpen: true, start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
        Wednesday: { isOpen: true, start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
        Thursday: { isOpen: true, start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
        Friday: { isOpen: true, start: '09:00', end: '16:00', breakStart: '12:00', breakEnd: '13:00' },
        Saturday: { isOpen: true, start: '10:00', end: '14:00', breakStart: '', breakEnd: '' },
        Sunday: { isOpen: false, start: '', end: '', breakStart: '', breakEnd: '' },
    });

    const [emergencyOverride, setEmergencyOverride] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleToggleDay = (day) => {
        setSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], isOpen: !prev[day].isOpen }
        }));
    };

    const handleTimeChange = (day, field, value) => {
        setSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value }
        }));
    };

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        }, 1500);
    };

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return (
        <div className="flex flex-col min-h-[calc(100vh-180px)] max-w-[1400px] mx-auto pb-10">
            {/* Main Content Area */}
            <div className="flex-1 space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-1 px-1 mb-6">
                    <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Working Hours</h1>
                    <p className="text-[13px] text-slate-400 font-medium tracking-tight uppercase">Configure clinic schedule and availability</p>
                </div>

                {/* Weekly Schedule Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                >
                    <div className="p-6 border-b border-slate-50 flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Clock size={18} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-[15px] font-black text-slate-800">Weekly Schedule</h2>
                    </div>

                    <div className="p-6 divide-y divide-slate-50">
                        {days.map((day) => (
                            <div key={day} className="py-5 flex flex-wrap items-center gap-x-8 gap-y-4">
                                {/* Day Toggle Area */}
                                <div className="flex items-center gap-4 min-w-[140px]">
                                    <button
                                        onClick={() => handleToggleDay(day)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${schedule[day].isOpen ? 'bg-indigo-500' : 'bg-slate-200'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${schedule[day].isOpen ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                    <span className={`text-[15px] font-bold ${schedule[day].isOpen ? 'text-slate-800' : 'text-slate-400'}`}>
                                        {day}
                                    </span>
                                </div>

                                {schedule[day].isOpen ? (
                                    <div className="flex flex-wrap items-center gap-6">
                                        {/* Shift Timing */}
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Start</span>
                                            <div className="relative">
                                                <input
                                                    type="time"
                                                    value={schedule[day].start}
                                                    onChange={(e) => handleTimeChange(day, 'start', e.target.value)}
                                                    className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all w-[130px]"
                                                />
                                            </div>
                                            <span className="text-slate-300">—</span>
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">End</span>
                                            <div className="relative">
                                                <input
                                                    type="time"
                                                    value={schedule[day].end}
                                                    onChange={(e) => handleTimeChange(day, 'end', e.target.value)}
                                                    className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all w-[130px]"
                                                />
                                            </div>
                                        </div>

                                        {/* Break Timing */}
                                        <div className="flex items-center gap-3 ml-4 bg-slate-50/50 px-4 py-2 rounded-xl border border-slate-50">
                                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">Break</span>
                                            <div className="relative ml-1">
                                                <input
                                                    type="time"
                                                    value={schedule[day].breakStart}
                                                    onChange={(e) => handleTimeChange(day, 'breakStart', e.target.value)}
                                                    className="px-3 py-2 bg-white border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all w-[130px]"
                                                />
                                            </div>
                                            <span className="text-slate-300">—</span>
                                            <div className="relative">
                                                <input
                                                    type="time"
                                                    value={schedule[day].breakEnd}
                                                    onChange={(e) => handleTimeChange(day, 'breakEnd', e.target.value)}
                                                    className="px-3 py-2 bg-white border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all w-[130px]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[13px] font-bold text-slate-400 uppercase tracking-wider">Closed</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Emergency Override Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                >
                    <div className="p-6 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                <AlertTriangle size={18} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-[14px] font-black text-slate-800">Emergency Override</h3>
                                <p className="text-[12px] text-slate-500 font-medium mt-0.5">Allow scheduling outside normal working hours for critical cases</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setEmergencyOverride(!emergencyOverride)}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${emergencyOverride ? 'bg-indigo-500' : 'bg-slate-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${emergencyOverride ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Action Bar */}
            <div className="mt-auto pt-12">
                <div className="flex items-center justify-end py-6 border-t border-slate-50">
                    <AnimatePresence>
                        {showSuccess && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="mr-4 px-6 py-3 bg-emerald-500 text-white rounded-2xl shadow-lg flex items-center gap-3 font-black text-sm"
                            >
                                <CheckCircle2 size={18} />
                                SCHEDULE SAVED
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`group relative px-10 py-4 text-white rounded-2xl font-black text-sm shadow-xl transition-all active:scale-95 flex items-center gap-3 overflow-hidden ${isSaving ? 'bg-slate-800 cursor-not-allowed shadow-none' : 'bg-indigo-600 shadow-indigo-100 hover:shadow-indigo-200'}`}
                    >
                        <Save size={18} className={`transition-transform ${isSaving ? "opacity-0" : "group-hover:scale-110"}`} />
                        <span>{isSaving ? "SAVING..." : "SAVE SCHEDULE"}</span>

                        {isSaving && (
                            <motion.div
                                className="absolute bottom-0 left-0 h-1 bg-indigo-400"
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 1.5 }}
                            />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
