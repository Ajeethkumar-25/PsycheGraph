import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { createSession } from '../../store/slices/SessionSlice';
import {
    Clock,
    Mic,
    Square,
    Save,
    FileText,
    Activity,
    Tag,
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    Loader2
} from 'lucide-react';

export default function DoctorSessionMode() {
    const { patientId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { list: patients } = useSelector((state) => state.patients);

    // Derived Data
    const patient = patients.find(p => String(p.id) === String(patientId)) || { full_name: 'Unknown Patient' };

    // --- State ---
    const [activeTab, setActiveTab] = useState('notes'); // 'notes', 'transcript', 'treatment'

    // Recording & Timer
    const [isRecording, setIsRecording] = useState(false);
    const [sessionTime, setSessionTime] = useState(0); // in seconds
    const [audioBlob, setAudioBlob] = useState(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    // Mock Live Transcript Data
    const [transcript, setTranscript] = useState([]);

    // Clinical Notes
    const [soapNotes, setSoapNotes] = useState({
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
    });
    const [treatmentPlan, setTreatmentPlan] = useState('');
    const [clinicalThemes, setClinicalThemes] = useState([]);
    const [currentThemeInput, setCurrentThemeInput] = useState('');
    const [saving, setSaving] = useState(false);

    // --- Timer Logic ---
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setSessionTime(prev => prev + 1);

                // Mock live transcription injection for demo purposes
                if (Math.random() > 0.8) {
                    const mockSentences = [
                        "Patient indicated high anxiety levels today.",
                        "Discussed previous week's challenges.",
                        "Sleep patterns remain inconsistent.",
                        "Reviewing coping mechanisms established last session."
                    ];
                    setTranscript(prev => [...prev, {
                        time: sessionTime,
                        text: mockSentences[Math.floor(Math.random() * mockSentences.length)],
                        speaker: Math.random() > 0.5 ? 'Doctor' : 'Patient'
                    }]);
                }
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isRecording, sessionTime]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // --- Recording Logic ---
    const startSession = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
                setAudioBlob(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            // Fallback for demo if mic fails
            setIsRecording(true);
        }
    };

    const stopSession = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    // --- Action Handlers ---
    const handleAddTheme = (e) => {
        if (e.key === 'Enter' && currentThemeInput.trim()) {
            e.preventDefault();
            if (!clinicalThemes.includes(currentThemeInput.trim())) {
                setClinicalThemes([...clinicalThemes, currentThemeInput.trim()]);
            }
            setCurrentThemeInput('');
        }
    };

    const removeTheme = (theme) => {
        setClinicalThemes(clinicalThemes.filter(t => t !== theme));
    };

    const handleSaveSessionData = async () => {
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('patient_id', patientId);
            formData.append('duration', sessionTime);
            formData.append('soap_notes', JSON.stringify(soapNotes));
            formData.append('treatment_plan', treatmentPlan);
            formData.append('themes', JSON.stringify(clinicalThemes));
            formData.append('transcript', JSON.stringify(transcript));

            if (audioBlob) {
                formData.append('file', audioBlob, `session_${patientId}_${Date.now()}.wav`);
            }

            // Mock Saving logic (replace with real endpoint if available)
            // await dispatch(createSession(formData)).unwrap();

            // Artificial delay for UI feedback
            await new Promise(resolve => setTimeout(resolve, 1500));

            navigate('/doctor/patients');
        } catch (err) {
            console.error('Failed to save session:', err);
            alert("Failed to save session data.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="h-[calc(100vh-80px)] w-full bg-slate-50 flex flex-col p-4 pr-10 overflow-hidden relative">
            {/* Header */}
            <header className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/doctor/patients')}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-black text-slate-900 leading-tight">{patient.full_name}</h1>
                            {isRecording && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse border border-red-100">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                    Live Session
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Clinical ID: #{String(patientId).padStart(4, '0')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Timer Display */}
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duration</span>
                        <div className={`text-2xl font-black tabular-nums tracking-tighter ${isRecording ? 'text-primary-600' : 'text-slate-700'}`}>
                            {formatTime(sessionTime)}
                        </div>
                    </div>

                    {/* Primary Controls */}
                    <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
                        {!isRecording && !audioBlob && (
                            <button
                                onClick={startSession}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                            >
                                <Mic size={18} />
                                Start Session
                            </button>
                        )}

                        {isRecording && (
                            <button
                                onClick={stopSession}
                                className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                            >
                                <Square size={18} />
                                Stop Session
                            </button>
                        )}

                        {(audioBlob || sessionTime > 0) && !isRecording && (
                            <button
                                onClick={handleSaveSessionData}
                                disabled={saving}
                                className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 disabled:opacity-70"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                {saving ? 'Saving...' : 'Finalize & Save'}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content Area - Split Pane */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* Left Pane: STT & Themes */}
                <div className="w-1/3 flex flex-col gap-4 min-h-0">
                    {/* Clinical Themes */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 shrink-0">
                        <div className="flex items-center gap-2 mb-4">
                            <Tag size={18} className="text-purple-500" />
                            <h3 className="font-bold text-slate-900">Clinical Themes</h3>
                        </div>
                        <input
                            type="text"
                            value={currentThemeInput}
                            onChange={e => setCurrentThemeInput(e.target.value)}
                            onKeyDown={handleAddTheme}
                            placeholder="Type theme and press Enter..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none mb-3 font-medium transition-all"
                        />
                        <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto">
                            <AnimatePresence>
                                {clinicalThemes.map((theme) => (
                                    <motion.span
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        key={theme}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-lg border border-purple-100"
                                    >
                                        {theme}
                                        <button onClick={() => removeTheme(theme)} className="hover:text-purple-900 transition-colors">
                                            &times;
                                        </button>
                                    </motion.span>
                                ))}
                            </AnimatePresence>
                            {clinicalThemes.length === 0 && (
                                <p className="text-xs text-slate-400 font-medium">No themes flagged yet.</p>
                            )}
                        </div>
                    </div>

                    {/* Live Transcript Display */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
                            <div className="flex items-center gap-2">
                                <Activity size={18} className="text-primary-500" />
                                <h3 className="font-bold text-slate-900">Live Transcript (STT)</h3>
                            </div>
                            {isRecording && (
                                <span className="text-[10px] font-bold text-primary-500 uppercase tracking-widest animate-pulse">Listening...</span>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50">
                            {transcript.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                                    <Mic size={32} className="text-slate-400 mb-3" />
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Awaiting Audio Input</p>
                                </div>
                            ) : (
                                transcript.map((entry, idx) => (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        key={idx}
                                        className={`flex flex-col ${entry.speaker === 'Doctor' ? 'items-end' : 'items-start'}`}
                                    >
                                        <span className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">
                                            {entry.speaker} • {formatTime(entry.time)}
                                        </span>
                                        <div className={`px-4 py-2.5 rounded-2xl max-w-[90%] text-sm font-medium ${entry.speaker === 'Doctor'
                                                ? 'bg-primary-600 text-white rounded-tr-sm shadow-md shadow-primary-500/10'
                                                : 'bg-white text-slate-700 rounded-tl-sm border border-slate-200 shadow-sm'
                                            }`}>
                                            {entry.text}
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Pane: Notes & Treatment */}
                <div className="w-2/3 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden min-h-0">
                    <div className="flex border-b border-slate-100 shrink-0">
                        {['notes', 'treatment'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-4 text-sm font-black uppercase tracking-widest transition-all ${activeTab === tab
                                        ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/30'
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {tab === 'notes' ? 'SOAP Notes' : 'Treatment Plan'}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
                        {activeTab === 'notes' ? (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    {Object.entries({
                                        subjective: "S: Subjective (Patient's reported experiences)",
                                        objective: "O: Objective (Clinician's observations)",
                                        assessment: "A: Assessment (Clinical impressions)",
                                        plan: "P: Plan (Immediate next steps)"
                                    }).map(([key, label]) => (
                                        <div key={key}>
                                            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">{label}</label>
                                            <textarea
                                                className="w-full resize-y min-h-[100px] border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all font-medium text-slate-800 bg-white shadow-sm"
                                                placeholder={`Enter ${key} notes...`}
                                                value={soapNotes[key]}
                                                onChange={e => setSoapNotes({ ...soapNotes, [key]: e.target.value })}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col">
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <FileText size={16} className="text-emerald-500" />
                                    Long-term Treatment Strategy
                                </label>
                                <textarea
                                    className="flex-1 resize-none w-full border border-slate-200 rounded-xl p-5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-800 bg-white shadow-sm leading-relaxed"
                                    placeholder="Outline the longitudinal treatment plan here..."
                                    value={treatmentPlan}
                                    onChange={e => setTreatmentPlan(e.target.value)}
                                />
                                <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3 text-amber-700 text-sm font-medium">
                                    <AlertCircle size={20} className="shrink-0 text-amber-500" />
                                    <p>Treatment plans are version controlled. Any changes saved here will generate a new version in the patient's clinical history.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
