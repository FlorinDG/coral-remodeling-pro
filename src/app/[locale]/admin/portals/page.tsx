"use client";

import { useEffect, useState } from 'react';
import LeadList from '@/components/admin/LeadList';
import BookingList from '@/components/admin/BookingList';
import PortalGrid from '@/components/admin/PortalGrid';
import { useTranslations } from 'next-intl';

export default function PortalsPage() {
    const t = useTranslations('Admin');
    const [leads, setLeads] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [portals, setPortals] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [leadsRes, bookingsRes, portalsRes] = await Promise.all([
                    fetch('/api/leads'),
                    fetch('/api/bookings'),
                    fetch('/api/portals')
                ]);

                // Helper to safely parse JSON or return empty array
                const parseSafe = async (res: Response) => {
                    if (!res.ok) {
                        console.error(`API Error ${res.url}: ${res.status}`);
                        return [];
                    }
                    try {
                        return await res.json();
                    } catch (e) {
                        console.error(`JSON Parse Error ${res.url}:`, e);
                        return [];
                    }
                };

                setLeads(await parseSafe(leadsRes));
                setBookings(await parseSafe(bookingsRes));
                setPortals(await parseSafe(portalsRes));
            } catch (error) {
                console.error("Failed to fetch admin data", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleCreatePortal = async () => {
        const name = prompt(t('namePrompt'));
        if (!name) return;
        const email = prompt(t('emailPrompt'));
        if (!email) return;

        try {
            const res = await fetch('/api/portals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientName: name, clientEmail: email })
            });
            if (!res.ok) throw new Error();
            window.location.reload();
        } catch (error) {
            alert(t('failedCreate'));
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center p-24">
            <div className="animate-pulse">{t('loading')}</div>
        </div>
    );

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d35400] mb-2">CRM</h2>
                <h1 className="text-4xl font-bold tracking-tight">Client Portals</h1>
                <p className="text-neutral-500 mt-2">Manage active projects and client communication via private portals.</p>
            </div>

            {/* Top Section: Portals (Generous Space) */}
            <section>
                <PortalGrid portals={portals} onCreateClick={handleCreatePortal} />
            </section>

            {/* Bottom Section: Leads & Bookings (Compact Lists) */}
            <section className="grid lg:grid-cols-2 gap-8 h-[600px]">
                <LeadList leads={leads} />
                <BookingList bookings={bookings} />
            </section>
        </div>
    );
}
