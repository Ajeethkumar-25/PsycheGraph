import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2,
    Mail,
    Phone,
    MapPin,
    Upload,
    Palette,
    Save,
    CheckCircle2,
    Info
} from 'lucide-react';

export default function Branding() {
    const [formData, setFormData] = useState({
        clinicName: 'CareAdmin Medical Center',
        email: 'info@careadmin.com',
        phone: '+1 (555) 123-4567',
        address: '123 Health Street, Medical City, MC 12345',
        brandColor: '#1c33dfff', // Default teal from screenshot
        logo: null
    });

    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    
    const handleSave = () => {
        setIsSaving(true);
        // Simulate API call
        setTimeout(() => {
            setIsSaving(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        }, 1500);
    };

    return (
        <div className="flex flex-col min-h-[calc(100vh-180px)] max-w-[1400px] mx-auto pb-10">
            {/* Main Content Area */}
            <div className="flex-1 space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-1 px-1 mb-6">
                    <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Branding</h1>
                    <p className="text-[13px] text-slate-400 font-medium tracking-tight uppercase">Customize your clinic's appearance</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                    {/* Left Column: Clinic Identity Form */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                    >
                        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                <Building2 size={18} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-[15px] font-black text-slate-800">Clinic Identity</h2>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* Clinic Name */}
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider ml-1">Clinic Name</label>
                                <input
                                    type="text"
                                    name="clinicName"
                                    value={formData.clinicName}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-700"
                                    placeholder="Enter clinic name"
                                />
                            </div>

                            {/* Contact Email */}
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider ml-1">Contact Email</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-700"
                                        placeholder="email@clinic.com"
                                    />
                                </div>
                            </div>

                            {/* Phone */}
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider ml-1">Phone</label>
                                <div className="relative">
                                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-700"
                                        placeholder="+1 (555) 000-0000"
                                    />
                                </div>
                            </div>

                            {/* Address */}
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider ml-1">Address</label>
                                <div className="relative">
                                    <MapPin size={16} className="absolute left-4 top-4 text-slate-400 pointer-events-none" />
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        rows={3}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-700 resize-none"
                                        placeholder="Full clinical address"
                                    />
                                </div>
                            </div>
                            {/* Clinic Logo */}
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider ml-1">Clinic Logo</label>
                                <div className="border-2 border-dashed border-slate-100 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 bg-slate-50/30 hover:bg-slate-50 transition-colors cursor-pointer group">
                                    <div className="p-3 bg-white shadow-sm rounded-xl text-slate-400 group-hover:text-indigo-600 transition-colors">
                                        <Upload size={24} strokeWidth={2} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-slate-600">Click or drag to upload logo</p>
                                        <p className="text-[11px] font-medium text-slate-400 mt-1 uppercase">PNG, JPG up to 2MB</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Column: Email Template Preview */}
                    <div className="space-y-6">
                        <div className="px-1">
                            <h3 className="text-[15px] font-black text-slate-800">Email Template Preview</h3>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white rounded-2xl border border-slate-100 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] overflow-hidden"
                        >
                            {/* Mock Email UI */}
                            <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex items-center gap-2">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                                </div>
                                <div className="mx-auto bg-white px-3 py-1 rounded-md border border-slate-100 text-[10px] text-slate-400 font-medium font-mono min-w-[200px] text-center">
                                    reminder@careadmin.com
                                </div>
                            </div>

                            <div className="p-8 lg:p-12">
                                <div className="max-w-[500px] mx-auto bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                    {/* Brand Header */}
                                    <div
                                        className="p-6 text-center text-white font-black tracking-tight"
                                        style={{ backgroundColor: formData.brandColor }}
                                    >
                                        {formData.clinicName}
                                    </div>

                                    {/* Email Content */}
                                    <div className="p-8 space-y-6">
                                        <p className="text-[15px] font-bold text-slate-800">Dear Patient,</p>

                                        <p className="text-sm text-slate-500 leading-relaxed font-medium">
                                            This is a reminder for your upcoming appointment on <span className="text-slate-800 font-bold whitespace-nowrap">March 15, 2026</span> at <span className="text-slate-800 font-bold whitespace-nowrap">10:00 AM</span>.
                                        </p>

                                        <p className="text-sm text-slate-400 font-medium">
                                            Please arrive 10 minutes early.
                                        </p>

                                        <div className="pt-4">
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Best regards,</p>
                                            <p className="text-[15px] font-black text-slate-800">
                                                {formData.clinicName}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="bg-slate-50 p-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100">
                                        © {new Date().getFullYear()} {formData.clinicName}. All rights reserved.
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Meta Info */}
                        <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100/50 flex gap-4">
                            <div className="shrink-0 w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
                                <Info size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800 tracking-tight">Email Notifications</p>
                                <p className="text-[12px] text-slate-500 font-medium mt-1 leading-relaxed">
                                    Updating your branding will automatically refresh all client-facing communications, including patient reminders and portal login pages.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

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
                                CHANGES SAVED
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`group relative px-10 py-4 text-white rounded-2xl font-black text-sm shadow-xl transition-all active:scale-95 flex items-center gap-3 overflow-hidden ${isSaving ? 'bg-slate-800 cursor-not-allowed shadow-none' : 'bg-indigo-600 shadow-indigo-100 hover:shadow-indigo-200'}`}
                    >
                        <Save size={18} className={`transition-transform ${isSaving ? "opacity-0" : "group-hover:scale-110"}`} />
                        <span>{isSaving ? "SAVING..." : "SAVE BRANDING"}</span>

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
