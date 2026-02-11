import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { FileText, Upload, Headphones, Sparkles, User, Calendar, MessageSquare, ChevronRight, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const Sessions = () => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);

    // Upload Form
    const [uploadData, setUploadData] = useState({
        patient_id: '',
        audio_file: null
    });

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const res = await api.get('/sessions');
            setSessions(res.data);
        } catch (err) {
            toast.error('Failed to fetch sessions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadData.audio_file) return toast.error('Please select an audio file');

        const formData = new FormData();
        formData.append('file', uploadData.audio_file);
        formData.append('patient_id', uploadData.patient_id);
        formData.append('date', new Date().toISOString());

        try {
            setUploading(true);
            await api.post('/sessions/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Session processed successfully!');
            setShowUploadModal(false);
            fetchSessions();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white">Medical Sessions</h1>
                    <p className="text-slate-400">Review AI-transcribed conversations and SOAP notes.</p>
                </div>
                <Button onClick={() => setShowUploadModal(true)}>
                    <Upload size={20} />
                    Upload Session
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Session List */}
                <div className="lg:col-span-4 space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    {sessions.map((session) => (
                        <motion.div
                            key={session.id}
                            onClick={() => setSelectedSession(session)}
                            className={`glass-card p-4 cursor-pointer transition-all border-l-4 ${selectedSession?.id === session.id ? 'border-primary-500 bg-white/10' : 'border-transparent hover:bg-white/5'
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-dark-700 flex items-center justify-center text-slate-400">
                                        <Headphones size={20} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-sm">Session #{session.id}</p>
                                        <p className="text-[10px] text-slate-500 flex items-center gap-1 uppercase tracking-wider">
                                            <User size={10} /> Patient {session.patient_id}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] text-slate-600 font-bold">{new Date(session.date).toLocaleDateString()}</span>
                            </div>
                        </motion.div>
                    ))}
                    {sessions.length === 0 && !loading && (
                        <div className="py-12 text-center glass-card border-dashed">
                            <p className="text-slate-600 italic text-sm">No sessions recorded yet.</p>
                        </div>
                    )}
                </div>

                {/* Details View */}
                <div className="lg:col-span-8">
                    <AnimatePresence mode="wait">
                        {selectedSession ? (
                            <motion.div
                                key={selectedSession.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="glass-card bg-gradient-to-br from-dark-800 to-dark-900 border-primary-500/10">
                                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-primary-500/10 rounded-2xl flex items-center justify-center text-primary-400 shadow-xl shadow-primary-500/5">
                                                <Sparkles size={32} />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-display font-bold text-white">AI Analysis Output</h2>
                                                <p className="text-sm text-slate-400">Generated using OpenAI Whisper & GPT-4o</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <FileText size={14} className="text-primary-500" />
                                                Medical Summary
                                            </h3>
                                            <div className="p-4 bg-white/5 rounded-xl text-sm leading-relaxed text-slate-200 min-h-[100px]">
                                                {selectedSession.summary || 'Summary not Available'}
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <Activity size={14} className="text-accent-500" />
                                                SOAP Note
                                            </h3>
                                            <div className="p-4 bg-white/5 rounded-xl text-sm leading-relaxed text-slate-200 min-h-[100px]">
                                                {selectedSession.soap_note || 'Analysis in progress...'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 space-y-3">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <MessageSquare size={14} className="text-indigo-400" />
                                            Full Transcript
                                        </h3>
                                        <div className="p-6 bg-dark-950/50 rounded-2xl text-sm leading-relaxed text-slate-300 max-h-60 overflow-y-auto italic font-serif">
                                            "{selectedSession.transcript || 'Transcribing audio...'}"
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="glass-card h-[60vh] flex flex-col items-center justify-center text-center opacity-40">
                                <FileText size={64} className="text-slate-700 mb-4" />
                                <p className="text-slate-500 font-medium">Select a session from the list to view <br /> transcriptions and medical insights.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Upload Modal */}
            <AnimatePresence>
                {showUploadModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-dark-950/90 backdrop-blur-md" onClick={() => setShowUploadModal(false)} />
                        <motion.div className="relative w-full max-w-lg glass-card border-white/20 p-8">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto text-primary-500 mb-4">
                                    <Upload size={32} />
                                </div>
                                <h2 className="text-2xl font-bold text-white">Upload Session Recording</h2>
                                <p className="text-slate-400 text-sm">The audio will be processed for medical transcription.</p>
                            </div>

                            <form onSubmit={handleUpload} className="space-y-6">
                                <Input
                                    label="Patient ID"
                                    placeholder="Enter patient ID"
                                    required
                                    value={uploadData.patient_id}
                                    onChange={e => setUploadData({ ...uploadData, patient_id: e.target.value })}
                                />

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400 ml-1">Audio File (WAV, MP3, M4A)</label>
                                    <div className="relative h-32 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center hover:border-primary-500/30 transition-colors bg-white/5 overflow-hidden">
                                        <input
                                            type="file"
                                            accept="audio/*"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={e => setUploadData({ ...uploadData, audio_file: e.target.files[0] })}
                                        />
                                        {uploadData.audio_file ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <Headphones className="text-primary-400" />
                                                <span className="text-xs text-white font-medium">{uploadData.audio_file.name}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="text-slate-600 mb-2" />
                                                <span className="text-xs text-slate-500">Drag & drop or catch from system</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button type="button" className="flex-1 bg-white/5" onClick={() => setShowUploadModal(false)}>Cancel</Button>
                                    <Button type="submit" className="flex-1 h-12" disabled={uploading}>
                                        {uploading ? 'Processing AI...' : 'Start Transcription'}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Sessions;
