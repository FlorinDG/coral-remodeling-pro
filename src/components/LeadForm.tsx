"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, startOfToday } from 'date-fns';

const TIMESLOTS = ["09:00 AM", "11:00 AM", "01:00 PM", "03:00 PM", "05:00 PM"];

interface LeadFormProps {
    initialTab?: 'inquiry' | 'booking';
    onClose?: () => void;
}

export default function LeadForm({ initialTab = 'inquiry', onClose }: LeadFormProps) {
    const [activeTab, setActiveTab] = useState<'inquiry' | 'booking'>(initialTab);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        service: 'Kitchen',
        message: ''
    });
    const [loading, setLoading] = useState(false);
    const [inquirySuccess, setInquirySuccess] = useState(false);
    const [showBookingUpsell, setShowBookingUpsell] = useState(false);

    // Booking state
    const [bookingStep, setBookingStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [bookingSuccess, setBookingSuccess] = useState(false);

    const dates = Array.from({ length: 7 }, (_, i) => addDays(startOfToday(), i + 1));

    const handleInquirySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                setInquirySuccess(true);
                setShowBookingUpsell(true);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleBookingSubmit = async () => {
        if (!selectedDate || !selectedSlot) return;
        setLoading(true);
        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientName: formData.name,
                    clientEmail: formData.email,
                    serviceType: formData.service,
                    date: selectedDate.toISOString(),
                    timeSlot: selectedSlot
                }),
            });
            if (res.ok) setBookingSuccess(true);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex gap-4 mb-8">
                <button
                    onClick={() => setActiveTab('inquiry')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all rounded-xl border ${activeTab === 'inquiry' ? 'bg-[#d35400] text-white border-[#d35400]' : 'bg-white/5 border-white/10 text-neutral-500 hover:border-white/40 hover:bg-white/10'}`}
                >
                    Inquiry
                </button>
                <button
                    onClick={() => setActiveTab('booking')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all rounded-xl border ${activeTab === 'booking' ? 'bg-[#d35400] text-white border-[#d35400]' : 'bg-white/5 border-white/10 text-neutral-500 hover:border-white/40 hover:bg-white/10'}`}
                >
                    Book Visit
                </button>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'inquiry' ? (
                    <motion.div
                        key="inquiry-tab"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex-1 flex flex-col"
                    >
                        {inquirySuccess ? (
                            <div className="flex-1 flex flex-col justify-center py-8 text-center">
                                {showBookingUpsell ? (
                                    <div className="space-y-6">
                                        <div className="text-4xl mb-4">✨</div>
                                        <h4 className="text-xl font-bold">Inquiry Received!</h4>
                                        <p className="text-neutral-400 text-sm">Would you also like to schedule a professional site visit right now?</p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => { setActiveTab('booking'); setShowBookingUpsell(false); }}
                                                className="flex-1 bg-[#d35400] text-white font-bold py-3 rounded-xl hover:bg-[#a04000] transition-colors"
                                            >
                                                YES, BOOK NOW
                                            </button>
                                            <button
                                                onClick={() => setShowBookingUpsell(false)}
                                                className="flex-1 bg-white/5 border border-white/10 font-bold py-3 rounded-xl hover:bg-white/10 transition-colors"
                                            >
                                                LATER
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="text-4xl mb-4">✅</div>
                                        <h4 className="text-xl font-bold">All Set!</h4>
                                        <p className="text-neutral-400">Our team will be in touch shortly.</p>
                                        <button onClick={() => setInquirySuccess(false)} className="text-sm underline opacity-50">Send another inquiry</button>
                                        {onClose && (
                                            <button onClick={onClose} className="mt-4 w-full py-3 bg-white/5 border border-white/10 rounded-xl font-bold">CLOSE</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <form onSubmit={handleInquirySubmit} className="space-y-4 flex-1 flex flex-col">
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-[50px] outline-none hover:border-white/30 focus:border-[#d35400] transition-all"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-[50px] outline-none hover:border-white/30 focus:border-[#d35400] transition-all"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                    <input
                                        type="tel"
                                        placeholder="Phone"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-[50px] outline-none hover:border-white/30 focus:border-[#d35400] transition-all"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                                <select
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-[50px] outline-none hover:border-white/30 focus:border-[#d35400] transition-all"
                                    value={formData.service}
                                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                                >
                                    <option value="Kitchen">Kitchen Remodeling</option>
                                    <option value="Bathroom">Bathroom Remodeling</option>
                                    <option value="Addition">Home Addition</option>
                                </select>
                                <textarea
                                    placeholder="Tell us about your project..."
                                    rows={2}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none hover:border-white/30 focus:border-[#d35400] transition-all resize-none flex-1"
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                />
                                <button
                                    disabled={loading}
                                    className="w-full bg-[#d35400] text-white font-bold py-4 rounded-xl hover:bg-[#a04000] transition-colors disabled:opacity-50 shadow-lg shadow-[#d35400]/20 mt-auto"
                                >
                                    {loading ? 'SENDING...' : 'REQUEST CONSULTATION'}
                                </button>
                            </form>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="booking-tab"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="flex-1 flex flex-col"
                    >
                        {bookingSuccess ? (
                            <div className="flex-1 flex flex-col justify-center py-12 text-center">
                                <div className="text-4xl mb-4">📅</div>
                                <h4 className="text-xl font-bold">Visit Confirmed!</h4>
                                <p className="text-neutral-400">Scheduled for {selectedDate && format(selectedDate, 'PPP')} at {selectedSlot}.</p>
                                <button onClick={() => { setBookingSuccess(false); setBookingStep(1); }} className="mt-6 text-sm underline opacity-50">Schedule another visit</button>
                                {onClose && (
                                    <button onClick={onClose} className="mt-4 w-full py-3 bg-white/5 border border-white/10 rounded-xl font-bold">CLOSE</button>
                                )}
                            </div>
                        ) : bookingStep === 1 ? (
                            <div className="flex-1 flex flex-col justify-center space-y-4">
                                <input
                                    type="text"
                                    placeholder="Your Name"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-[50px] outline-none hover:border-white/30 focus:border-[#d35400] transition-all"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                                <input
                                    type="email"
                                    placeholder="Your Email"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-[50px] outline-none hover:border-white/30 focus:border-[#d35400] transition-all"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                                <button
                                    onClick={() => setBookingStep(2)}
                                    disabled={!formData.name || !formData.email}
                                    className="w-full bg-[#d35400] text-white font-bold py-4 rounded-xl hover:bg-[#a04000] transition-colors shadow-lg shadow-[#d35400]/20 disabled:opacity-50"
                                >
                                    CHOOSE DATE & TIME
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col justify-center space-y-6">
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {dates.map((d) => (
                                        <button
                                            key={d.toISOString()}
                                            onClick={() => setSelectedDate(d)}
                                            className={`flex-shrink-0 w-16 h-16 rounded-xl border flex flex-col items-center justify-center transition-all ${selectedDate && format(selectedDate, 'P') === format(d, 'P') ? 'bg-[#d35400] border-[#d35400]' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                                        >
                                            <span className="text-[8px] uppercase">{format(d, 'EEE')}</span>
                                            <span className="text-lg font-bold">{format(d, 'd')}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {TIMESLOTS.map((slot) => (
                                        <button
                                            key={slot}
                                            onClick={() => setSelectedSlot(slot)}
                                            className={`py-2 rounded-lg border text-xs font-bold transition-all ${selectedSlot === slot ? 'bg-[#d35400] border-[#d35400]' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                                        >
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-3 mt-auto">
                                    <button onClick={() => setBookingStep(1)} className="flex-1 bg-white/5 border border-white/10 py-3 rounded-xl font-bold">BACK</button>
                                    <button
                                        disabled={!selectedDate || !selectedSlot}
                                        onClick={handleBookingSubmit}
                                        className="flex-[2] bg-[#d35400] text-white py-3 rounded-xl font-bold disabled:opacity-50"
                                    >
                                        {loading ? 'CONFIRMING...' : 'CONFIRM VISIT'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
