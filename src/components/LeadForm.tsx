"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, startOfToday } from 'date-fns';
import { Check, MessageCircle, Phone, Mail } from 'lucide-react';
import Autocomplete from 'react-google-autocomplete';
import { useTranslations, useLocale } from 'next-intl';
import { nl, enUS, fr } from 'date-fns/locale';

const localeMap: Record<string, import('date-fns').Locale> = { nl, en: enUS, fr };

const RAW_TIMESLOTS = [9, 11, 13, 15, 17];

interface LeadFormProps {
    initialTab?: 'inquiry' | 'booking';
    onClose?: () => void;
}

export default function LeadForm({ initialTab = 'inquiry', onClose }: LeadFormProps) {
    const t = useTranslations('LeadForm');
    const locale = useLocale();
    const currentLocale = localeMap[locale] || enUS;

    const TIMESLOTS = RAW_TIMESLOTS.map(hour => {
        const d = new Date();
        d.setHours(hour, 0, 0, 0);
        return format(d, t('timeFormat'));
    });

    const [activeTab, setActiveTab] = useState<'inquiry' | 'booking'>(initialTab);
    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        street: '',
        postalCode: '',
        town: '',
        email: '',
        phone: '',
        service: 'Kitchen',
        message: ''
    });
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false); // New state for button animation
    const [inquirySuccess, setInquirySuccess] = useState(false);
    const [showBookingUpsell, setShowBookingUpsell] = useState(false);

    // Booking state
    const [bookingStep, setBookingStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [bookingSuccess, setBookingSuccess] = useState(false);

    const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i + 1));

    const handleInquirySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            let uploadedFileLink = null;
            if (file) {
                const uploadData = new FormData();
                uploadData.append('action', 'upload_file');
                uploadData.append('file', file);
                uploadData.append('moduleTag', 'Lead');

                const uploadRes = await fetch('/api/drive', {
                    method: 'POST',
                    body: uploadData,
                });
                if (!uploadRes.ok) throw new Error("File upload failed");
                const uploadJson = await uploadRes.json();
                uploadedFileLink = uploadJson.node?.webViewLink;
            }

            // Bundle address into message to avoid DB migration and protect Notion Sync
            let finalMessage = formData.message;
            const addressParts = [formData.street, formData.postalCode, formData.town].filter(Boolean);
            if (addressParts.length > 0) {
                finalMessage = `Address: ${addressParts.join(', ')}\n\n${formData.message}`;
            }
            if (uploadedFileLink) {
                finalMessage += `\n\nAttached File: ${uploadedFileLink}`;
            }
            const finalName = `${formData.name} ${formData.surname}`.trim();

            const res = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: finalName,
                    email: formData.email,
                    phone: formData.phone,
                    service: formData.service,
                    message: finalMessage
                }),
            });

            if (res.ok) {
                // Track Conversion
                if (typeof window !== 'undefined' && (window as any).gtag) {
                    (window as any).gtag('event', 'generate_lead', {
                        'event_category': 'Contact',
                        'event_label': formData.service,
                        'value': 1
                    });
                }

                setSent(true);
                setTimeout(() => {
                    setInquirySuccess(true);
                    setShowBookingUpsell(true);
                    setSent(false); // Reset for next time if needed
                    setLoading(false);
                }, 1500); // Wait for "Sent!" animation
            } else {
                const data = await res.json();
                setError(data.error || t('errors.generic'));
                setLoading(false);
            }
        } catch (err) {
            console.error(err);
            setError(t('errors.connection'));
            setLoading(false);
        }
    };

    const handleBookingSubmit = async () => {
        if (!selectedDate || !selectedSlot) return;
        setLoading(true);
        setError(null);

        try {
            let uploadedFileLink = null;
            if (file) {
                const uploadData = new FormData();
                uploadData.append('action', 'upload_file');
                uploadData.append('file', file);
                uploadData.append('moduleTag', 'Booking');

                const uploadRes = await fetch('/api/drive', {
                    method: 'POST',
                    body: uploadData,
                });
                if (!uploadRes.ok) throw new Error("File upload failed");
                const uploadJson = await uploadRes.json();
                uploadedFileLink = uploadJson.node?.webViewLink;
            }

            const finalName = `${formData.name} ${formData.surname}`.trim();

            let finalMessage = formData.message;
            const addressParts = [formData.street, formData.postalCode, formData.town].filter(Boolean);
            if (addressParts.length > 0) {
                finalMessage = `Address: ${addressParts.join(', ')}\n\n${formData.message}`;
            }
            if (uploadedFileLink) {
                finalMessage += `\n\nAttached File: ${uploadedFileLink}`;
            }

            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientName: finalName,
                    clientEmail: formData.email,
                    serviceType: formData.service,
                    date: selectedDate.toISOString(),
                    timeSlot: selectedSlot,
                    message: finalMessage
                }),
            });
            if (res.ok) {
                // Track Conversion
                if (typeof window !== 'undefined' && (window as any).gtag) {
                    (window as any).gtag('event', 'generate_lead', {
                        'event_category': 'Booking',
                        'event_label': formData.service,
                        'value': 1
                    });
                }

                setSent(true);
                setTimeout(() => {
                    setBookingSuccess(true);
                    setSent(false);
                    setLoading(false);
                }, 1500);
            } else {
                const data = await res.json();
                setError(data.error || t('errors.generic'));
                setLoading(false);
            }
        } catch (err) {
            console.error(err);
            setError(t('errors.connection'));
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex gap-4 mb-4">
                <button
                    onClick={() => setActiveTab('inquiry')}
                    className={`flex-1 py-3 text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all rounded-xl border ${activeTab === 'inquiry' ? 'bg-[#d75d00] text-white border-[#d75d00]' : 'bg-neutral-50 dark:bg-white/5 border-neutral-300 dark:border-white/10 text-neutral-500 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-white/40 hover:bg-neutral-100 dark:hover:bg-white/10'}`}
                >
                    {t('tabs.inquiry')}
                </button>
                <button
                    onClick={() => setActiveTab('booking')}
                    className={`flex-1 py-3 text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all rounded-xl border ${activeTab === 'booking' ? 'bg-[#d75d00] text-white border-[#d75d00]' : 'bg-neutral-50 dark:bg-white/5 border-neutral-300 dark:border-white/10 text-neutral-500 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-white/40 hover:bg-neutral-100 dark:hover:bg-white/10'}`}
                >
                    {t('tabs.booking')}
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
                                        <h4 className="text-xl font-bold">{t('success.inquiryTitle')}</h4>
                                        <p className="text-neutral-300 text-sm">{t('success.inquirySub')}</p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => { setActiveTab('booking'); setShowBookingUpsell(false); }}
                                                className="flex-1 bg-[#d75d00] text-white font-bold py-3 rounded-xl hover:bg-[#b05000] transition-colors"
                                            >
                                                {t('buttons.yesBook')}
                                            </button>
                                            <button
                                                onClick={() => setShowBookingUpsell(false)}
                                                className="flex-1 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 font-bold py-3 rounded-xl hover:bg-white/10 transition-colors"
                                            >
                                                {t('buttons.later')}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="text-4xl mb-4">✅</div>
                                        <h4 className="text-xl font-bold">{t('success.allSet')}</h4>
                                        <p className="text-neutral-300">{t('success.touchShortly')}</p>
                                        <button onClick={() => setInquirySuccess(false)} className="text-sm underline opacity-50">{t('success.anotherInquiry')}</button>
                                        {onClose && (
                                            <button onClick={onClose} className="mt-4 w-full py-3 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl font-bold">{t('buttons.close')}</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <form onSubmit={handleInquirySubmit} className="space-y-3 flex-1 flex flex-col -mx-1 px-1 overflow-y-auto max-h-[460px] custom-scrollbar">
                                    <p className="text-xs text-neutral-500 font-medium px-1 mb-1">{t('messages.inquiryWarning')}</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            placeholder={t('placeholders.name')}
                                            required
                                            className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-[44px] outline-none hover:border-white/30 focus:border-[#d75d00] transition-all text-neutral-900 dark:text-white placeholder:text-neutral-400 text-sm"
                                            value={formData.name}
                                            onChange={(e) => {
                                                setFormData({ ...formData, name: e.target.value });
                                                setError(null);
                                            }}
                                        />
                                        <input
                                            type="text"
                                            placeholder={t('placeholders.surname')}
                                            required
                                            className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-[44px] outline-none hover:border-white/30 focus:border-[#d75d00] transition-all text-neutral-900 dark:text-white placeholder:text-neutral-400 text-sm"
                                            value={formData.surname}
                                            onChange={(e) => {
                                                setFormData({ ...formData, surname: e.target.value });
                                                setError(null);
                                            }}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="email"
                                            placeholder={t('placeholders.email')}
                                            required
                                            className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-[44px] outline-none hover:border-white/30 focus:border-[#d75d00] transition-all text-neutral-900 dark:text-white placeholder:text-neutral-400 text-sm"
                                            value={formData.email}
                                            onChange={(e) => {
                                                setFormData({ ...formData, email: e.target.value });
                                                setError(null);
                                            }}
                                        />
                                        <input
                                            type="tel"
                                            placeholder={t('placeholders.phone')}
                                            className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-[44px] outline-none hover:border-white/30 focus:border-[#d75d00] transition-all text-neutral-900 dark:text-white placeholder:text-neutral-400 text-sm"
                                            value={formData.phone}
                                            onChange={(e) => {
                                                setFormData({ ...formData, phone: e.target.value });
                                                setError(null);
                                            }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <select
                                            className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-[44px] outline-none hover:border-white/30 focus:border-[#d75d00] transition-all text-neutral-900 dark:text-white placeholder:text-neutral-400 text-sm"
                                            value={formData.service}
                                            onChange={(e) => {
                                                setFormData({ ...formData, service: e.target.value });
                                                setError(null);
                                            }}
                                        >
                                            <option value="Kitchen">{t('services.kitchen')}</option>
                                            <option value="Bathroom">{t('services.bathroom')}</option>
                                            <option value="Addition">{t('services.addition')}</option>
                                        </select>
                                        <div className="relative w-full h-[44px]">
                                            <input
                                                type="file"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                onChange={(e) => {
                                                    setFile(e.target.files?.[0] || null);
                                                    setError(null);
                                                }}
                                            />
                                            <div className="w-full h-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 flex items-center justify-between text-neutral-400 text-sm hover:border-white/30 transition-all pointer-events-none">
                                                <span className="truncate pr-2">{file ? file.name : t('placeholders.file')}</span>
                                                <span className="text-lg flex-shrink-0">📎</span>
                                            </div>
                                        </div>
                                    </div>
                                    <textarea
                                        placeholder={t('placeholders.message')}
                                        required
                                        rows={2}
                                        className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none hover:border-white/30 focus:border-[#d75d00] transition-all resize-none flex-1 text-neutral-900 dark:text-white placeholder:text-neutral-400 text-sm min-h-[60px]"
                                        value={formData.message}
                                        onChange={(e) => {
                                            setFormData({ ...formData, message: e.target.value });
                                            setError(null);
                                        }}
                                    />
                                    {error && (
                                        <p className="text-red-500 text-[10px] text-center font-medium animate-pulse">{error}</p>
                                    )}
                                    <motion.button
                                        type="submit"
                                        disabled={loading}
                                        className={`w-full font-bold py-3 mt-1 rounded-xl transition-colors disabled:opacity-50 shadow-lg flex items-center justify-center gap-2 ${sent ? 'bg-green-500 text-white' : 'bg-[#d75d00] text-white hover:bg-[#b05000] shadow-[#d75d00]/20'}`}
                                        animate={sent ? { scale: [1, 1.05, 1] } : {}}
                                    >
                                        {sent ? (
                                            <>
                                                <Check className="w-5 h-5" />
                                                {t('buttons.sent')}
                                            </>
                                        ) : (
                                            loading ? t('buttons.sending') : t('buttons.submit')
                                        )}
                                    </motion.button>
                                </form>

                                {/* Direct Contact Links */}
                                <div className="mt-auto pt-6 border-t border-neutral-200 dark:border-white/10">
                                    <p className="text-[10px] text-neutral-400 dark:text-neutral-300 font-bold uppercase tracking-widest mb-4 text-center">
                                        {t('directContact.title')}
                                    </p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <a
                                            href="https://wa.me/32472741025"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex flex-col items-center justify-center gap-2 py-3 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 hover:border-[#d75d00] transition-colors group"
                                        >
                                            <MessageCircle className="w-5 h-5 text-neutral-400 group-hover:text-[#d75d00] transition-colors" />
                                            <span className="text-[10px] font-bold uppercase tracking-tighter text-neutral-500 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white truncate px-1 text-center font-oxanium">
                                                {t('directContact.whatsapp')}
                                            </span>
                                        </a>
                                        <a
                                            href="tel:+32472741025"
                                            className="flex flex-col items-center justify-center gap-2 py-3 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 hover:border-[#d75d00] transition-colors group"
                                        >
                                            <Phone className="w-5 h-5 text-neutral-400 group-hover:text-[#d75d00] transition-colors" />
                                            <span className="text-[10px] font-bold uppercase tracking-tighter text-neutral-500 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white truncate px-1 text-center font-oxanium">
                                                {t('directContact.call')}
                                            </span>
                                        </a>
                                        <a
                                            href="mailto:info@coral-group.be"
                                            className="flex flex-col items-center justify-center gap-2 py-3 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 hover:border-[#d75d00] transition-colors group"
                                        >
                                            <Mail className="w-5 h-5 text-neutral-400 group-hover:text-[#d75d00] transition-colors" />
                                            <span className="text-[10px] font-bold uppercase tracking-tighter text-neutral-500 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white truncate px-1 text-center font-oxanium">
                                                {t('directContact.email')}
                                            </span>
                                        </a>
                                    </div>
                                </div>
                            </>
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
                                <h4 className="text-xl font-bold">{t('success.visitConfirmed')}</h4>
                                <p className="text-neutral-400">
                                    {selectedDate && t('success.scheduledFor', {
                                        date: format(selectedDate, 'PPP', { locale: currentLocale }),
                                        time: selectedSlot || ''
                                    })}
                                </p>
                                <button onClick={() => { setBookingSuccess(false); setBookingStep(1); }} className="mt-6 text-sm underline opacity-50">{t('success.anotherVisit')}</button>
                                {onClose && (
                                    <button onClick={onClose} className="mt-4 w-full py-3 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl font-bold">{t('buttons.close')}</button>
                                )}
                            </div>
                        ) : bookingStep === 1 ? (
                            <div className="flex-1 flex flex-col -mx-1 px-1 overflow-y-auto max-h-[460px] custom-scrollbar space-y-3">
                                <p className="text-xs text-neutral-500 font-medium px-1 mb-1">{t('messages.bookingWarning')}</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        placeholder={t('placeholders.yourName')}
                                        required
                                        className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-[44px] outline-none hover:border-white/30 focus:border-[#d75d00] transition-all text-neutral-900 dark:text-white placeholder:text-neutral-400 text-sm"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                    <input
                                        type="email"
                                        placeholder={t('placeholders.yourEmail')}
                                        required
                                        className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-[44px] outline-none hover:border-white/30 focus:border-[#d75d00] transition-all text-neutral-900 dark:text-white placeholder:text-neutral-400 text-sm"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <Autocomplete
                                    apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                    onPlaceSelected={(place) => {
                                        if (place && place.formatted_address) {
                                            setFormData({ ...formData, street: place.formatted_address, town: '', postalCode: '' });
                                            setError(null);
                                        }
                                    }}
                                    options={{
                                        types: ["address"],
                                        componentRestrictions: { country: "be" },
                                    }}
                                    placeholder={t('placeholders.street')} // Can use a more generic "Address" placeholder if we had one, this works fine too
                                    required
                                    className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-[44px] outline-none hover:border-white/30 focus:border-[#d75d00] transition-all text-neutral-900 dark:text-white placeholder:text-neutral-400 text-sm"
                                    defaultValue={formData.street}
                                    onChange={(e: any) => setFormData({ ...formData, street: e.target.value })}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <select
                                        className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 h-[44px] outline-none hover:border-white/30 focus:border-[#d75d00] transition-all text-neutral-900 dark:text-white placeholder:text-neutral-400 text-sm"
                                        value={formData.service}
                                        onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                                    >
                                        <option value="Kitchen">{t('services.kitchen')}</option>
                                        <option value="Bathroom">{t('services.bathroom')}</option>
                                        <option value="Addition">{t('services.addition')}</option>
                                    </select>
                                    <div className="relative w-full h-[44px]">
                                        <input
                                            type="file"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                                        />
                                        <div className="w-full h-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 flex items-center justify-between text-neutral-400 text-sm hover:border-white/30 transition-all pointer-events-none">
                                            <span className="truncate pr-2">{file ? file.name : t('placeholders.file')}</span>
                                            <span className="text-lg flex-shrink-0">📎</span>
                                        </div>
                                    </div>
                                </div>
                                <textarea
                                    placeholder={t('placeholders.message')}
                                    required
                                    rows={2}
                                    className="w-full bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none hover:border-white/30 focus:border-[#d75d00] transition-all resize-none flex-1 text-neutral-900 dark:text-white placeholder:text-neutral-400 text-sm min-h-[60px]"
                                    value={formData.message}
                                    onChange={(e) => {
                                        setFormData({ ...formData, message: e.target.value });
                                        setError(null);
                                    }}
                                />
                                <button
                                    onClick={() => setBookingStep(2)}
                                    disabled={!formData.name || !formData.email || !formData.street}
                                    className="w-full bg-[#d75d00] text-white font-bold py-4 rounded-xl mt-auto hover:bg-[#b05000] transition-colors shadow-lg shadow-[#d75d00]/20 disabled:opacity-50"
                                >
                                    {t('buttons.chooseDate')}
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col justify-center space-y-6">
                                <div className="grid grid-cols-7 gap-2 pb-2">
                                    {dates.map((d) => {
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                        return (
                                            <button
                                                key={d.toISOString()}
                                                onClick={() => !isWeekend && setSelectedDate(d)}
                                                disabled={isWeekend}
                                                className={`
                                                    flex-shrink-0 w-full h-16 rounded-xl border flex flex-col items-center justify-center transition-all
                                                    ${selectedDate && format(selectedDate, 'P') === format(d, 'P')
                                                        ? 'bg-[#d75d00] border-[#d75d00] text-white'
                                                        : isWeekend
                                                            ? 'border-white/5 bg-white/2 opacity-30 cursor-not-allowed'
                                                            : 'border-white/10 bg-white/5 hover:border-white/30'}
                                                `}
                                            >
                                                <span className="text-[8px] uppercase">{format(d, 'EEE', { locale: currentLocale })}</span>
                                                <span className="text-lg font-bold">{format(d, 'd')}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {TIMESLOTS.map((slot) => (
                                        <button
                                            key={slot}
                                            onClick={() => setSelectedSlot(slot)}
                                            className={`py-2 rounded-lg border text-xs font-bold transition-all ${selectedSlot === slot ? 'bg-[#d75d00] border-[#d75d00]' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                                        >
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-3 mt-auto">
                                    <button onClick={() => setBookingStep(1)} className="flex-1 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 py-3 rounded-xl font-bold">{t('buttons.back')}</button>
                                    <div className="flex-[2] flex flex-col gap-2">
                                        {error && (
                                            <p className="text-red-500 text-[10px] text-center font-medium">{error}</p>
                                        )}
                                        <motion.button
                                            disabled={!selectedDate || !selectedSlot || loading}
                                            onClick={handleBookingSubmit}
                                            className={`w-full py-3 rounded-xl font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-2 ${sent ? 'bg-green-500 text-white' : 'bg-[#d75d00] text-white'}`}
                                            animate={sent ? { scale: [1, 1.05, 1] } : {}}
                                        >
                                            {sent ? (
                                                <>
                                                    <Check className="w-5 h-5" />
                                                    {t('buttons.confirmed')}
                                                </>
                                            ) : (
                                                loading ? t('buttons.confirming') : t('buttons.confirm')
                                            )}
                                        </motion.button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
