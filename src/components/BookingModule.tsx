"use client";

import { useState } from 'react';
import { format, addDays, startOfToday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const TIMESLOTS = ["09:00 AM", "11:00 AM", "01:00 PM", "03:00 PM", "05:00 PM"];

export default function BookingModule() {
    const [step, setStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [bookingInfo, setBookingInfo] = useState({ name: '', email: '', service: 'Kitchen' });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i + 1));

    const handleBooking = async () => {
        if (!selectedDate || !selectedSlot) return;
        setLoading(true);
        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientName: bookingInfo.name,
                    clientEmail: bookingInfo.email,
                    serviceType: bookingInfo.service,
                    date: selectedDate.toISOString(),
                    timeSlot: selectedSlot
                }),
            });
            if (res.ok) setSuccess(true);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <section id="book" className="py-24 px-8 md:px-16 bg-neutral-950/50">
            <div className="container mx-auto max-w-4xl glass-morphism p-12 rounded-[3rem] border border-white/5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                    <div>
                        <h2 className="text-4xl font-bold tracking-tight mb-2">Book Site Visit</h2>
                        <p className="text-neutral-500 uppercase tracking-widest text-xs">Secure your consultation slot</p>
                    </div>
                    <div className="flex gap-2">
                        {[1, 2, 3].map((s) => (
                            <div
                                key={s}
                                className={`w-12 h-1 bg-${step === s ? 'white' : 'neutral-800'} transition-colors rounded-full`}
                            />
                        ))}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {success ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-20"
                        >
                            <h3 className="text-3xl font-bold mb-4">Confirmed!</h3>
                            <p className="text-neutral-400 mb-8">Site visit scheduled for {selectedDate && format(selectedDate, 'PPP')} at {selectedSlot}.</p>
                            <button onClick={() => { setSuccess(false); setStep(1); }} className="bg-white text-black px-8 py-3 rounded-full font-bold">BOOK ANOTHER</button>
                        </motion.div>
                    ) : step === 1 ? (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="grid md:grid-cols-2 gap-8"
                        >
                            <div className="space-y-4">
                                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">Select Service</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {['Kitchen', 'Bathroom', 'Addition', 'Other'].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setBookingInfo({ ...bookingInfo, service: s })}
                                            className={`p-4 rounded-2xl border ${bookingInfo.service === s ? 'border-white bg-white/10' : 'border-white/5 bg-white/3'} text-sm font-medium transition-all`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">Contact Details</label>
                                <input
                                    type="text"
                                    placeholder="Your Name"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none"
                                    onChange={(e) => setBookingInfo({ ...bookingInfo, name: e.target.value })}
                                />
                                <input
                                    type="email"
                                    placeholder="Your Email"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none"
                                    onChange={(e) => setBookingInfo({ ...bookingInfo, email: e.target.value })}
                                />
                                <button
                                    onClick={() => setStep(2)}
                                    disabled={!bookingInfo.name || !bookingInfo.email}
                                    className="w-full bg-white text-black font-bold py-4 rounded-xl disabled:opacity-50"
                                >
                                    NEXT STEP
                                </button>
                            </div>
                        </motion.div>
                    ) : step === 2 ? (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className="grid grid-cols-3 md:grid-cols-7 gap-4 pb-4">
                                {dates.map((d) => {
                                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                    return (
                                        <button
                                            key={d.toISOString()}
                                            onClick={() => !isWeekend && setSelectedDate(d)}
                                            disabled={isWeekend}
                                            className={`
                                                flex-shrink-0 w-full h-24 rounded-2xl border flex flex-col items-center justify-center transition-all
                                                ${selectedDate && format(selectedDate, 'P') === format(d, 'P')
                                                    ? 'border-white bg-white text-black'
                                                    : isWeekend
                                                        ? 'border-white/5 bg-white/2 opacity-30 cursor-not-allowed'
                                                        : 'border-white/5 bg-white/5 hover:bg-white/10'}
                                            `}
                                        >
                                            <span className="text-[10px] uppercase font-bold opacity-50">{format(d, 'EEE')}</span>
                                            <span className="text-2xl font-bold">{format(d, 'd')}</span>
                                            <span className="text-[10px] items-center uppercase font-bold opacity-50">{format(d, 'MMM')}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedDate && (
                                <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                                    {TIMESLOTS.map((slot) => (
                                        <button
                                            key={slot}
                                            onClick={() => setSelectedSlot(slot)}
                                            className={`py-3 rounded-xl border text-sm font-bold transition-all ${selectedSlot === slot ? 'border-white bg-white text-black' : 'border-white/5 bg-white/5'}`}
                                        >
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-4 pt-4">
                                <button onClick={() => setStep(1)} className="flex-1 border border-white/10 py-4 rounded-xl font-bold">BACK</button>
                                <button
                                    disabled={!selectedDate || !selectedSlot || loading}
                                    onClick={handleBooking}
                                    className="flex-[2] bg-white text-black py-4 rounded-xl font-bold disabled:opacity-50"
                                >
                                    {loading ? 'CONFIRMING...' : 'CONFIRM VISIT'}
                                </button>
                            </div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>
        </section>
    );
}
