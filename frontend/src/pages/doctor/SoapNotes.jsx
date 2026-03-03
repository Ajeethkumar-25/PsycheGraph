import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    Calendar,
    ChevronDown,
    Save,
    CheckCircle2,
    Link2,
    Download,
    History,
    FileText
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

export default function SoapNotes() {
    // Example state; in a real app this would connect to Redux
    const [activeTab, setActiveTab] = useState('Create / Edit');
    const [patient, setPatient] = useState('');
    const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
    const [diagnosis, setDiagnosis] = useState('');

    const [notes, setNotes] = useState({
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
    });

    const handleNoteChange = (field, value) => {
        setNotes(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-6 pb-20 pt-4 px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">SOAP Notes</h1>
                <p className="text-slate-500 font-medium text-sm sm:text-base">Create and manage structured clinical notes</p>
            </div>

            {/* Top Navigation Pills */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                {['Create / Edit', 'All Notes'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "px-4 py-2 text-sm font-bold rounded-lg transition-all",
                            activeTab === tab
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Main Form Container */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-8">

                {/* Top Row: Patient & Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-20">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-800">Patient</label>
                        <div className="relative">
                            <select
                                value={patient}
                                onChange={(e) => setPatient(e.target.value)}
                                className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 appearance-none font-medium cursor-pointer"
                            >
                                <option value="" disabled>Select patient</option>
                                <option value="1">Emily Carter</option>
                                <option value="2">James Wilson</option>
                                <option value="3">Maria Rodriguez</option>
                            </select>
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                                <ChevronDown size={16} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-800">Session Date</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={sessionDate}
                                onChange={(e) => setSessionDate(e.target.value)}
                                className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 font-medium [color-scheme:light]"
                            />
                        </div>
                    </div>
                </div>

                {/* Subjective */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-sm">S</div>
                        <label className="text-sm font-bold text-slate-800">Subjective</label>
                    </div>
                    <textarea
                        value={notes.subjective}
                        onChange={(e) => handleNoteChange('subjective', e.target.value)}
                        placeholder="Patient's reported symptoms, feelings, concerns..."
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 min-h-[120px] resize-y placeholder:text-slate-400"
                    />
                </div>

                {/* Objective */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-sm">O</div>
                        <label className="text-sm font-bold text-slate-800">Objective</label>
                    </div>
                    <textarea
                        value={notes.objective}
                        onChange={(e) => handleNoteChange('objective', e.target.value)}
                        placeholder="Clinical observations, mental status exam, behavioral notes..."
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 min-h-[120px] resize-y placeholder:text-slate-400"
                    />
                </div>

                {/* Assessment */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-sm">A</div>
                        <label className="text-sm font-bold text-slate-800">Assessment</label>
                    </div>
                    <textarea
                        value={notes.assessment}
                        onChange={(e) => handleNoteChange('assessment', e.target.value)}
                        placeholder="Clinical interpretation, progress evaluation..."
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 min-h-[120px] resize-y placeholder:text-slate-400"
                    />
                </div>

                {/* Diagnosis Details Placeholder */}
                <div className="relative z-10">
                    <div className="relative">
                        <select
                            value={diagnosis}
                            onChange={(e) => setDiagnosis(e.target.value)}
                            className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 appearance-none font-medium cursor-pointer"
                        >
                            <option value="" disabled>Select diagnosis (ICD-10)</option>
                            <option value="F41.1">Generalized Anxiety Disorder (F41.1)</option>
                            <option value="F32.9">Major Depressive Disorder (F32.9)</option>
                            <option value="F43.10">Post-traumatic Stress Disorder (F43.10)</option>
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                            <ChevronDown size={16} />
                        </div>
                    </div>
                </div>

                {/* Plan */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-sm">P</div>
                        <label className="text-sm font-bold text-slate-800">Plan</label>
                    </div>
                    <textarea
                        value={notes.plan}
                        onChange={(e) => handleNoteChange('plan', e.target.value)}
                        placeholder="Treatment steps, follow-ups, medication notes, referrals..."
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 min-h-[120px] resize-y placeholder:text-slate-400"
                    />
                </div>

                {/* Bottom Action Bar */}
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-all shadow-sm">
                        <Save size={16} className="text-slate-400" /> Save Draft
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-indigo-600/20">
                        <CheckCircle2 size={16} /> Save as Final
                    </button>

                    <div className="w-px h-6 bg-slate-200 mx-2 hidden sm:block"></div>

                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 rounded-xl text-sm font-bold transition-all shadow-sm">
                        <Link2 size={16} /> Link Transcript
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all shadow-sm">
                        <Download size={16} className="text-slate-400" /> Export PDF
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all shadow-sm ml-auto">
                        <History size={16} className="text-slate-400" /> Version History
                    </button>
                </div>
            </div>
        </div>
    );
}
