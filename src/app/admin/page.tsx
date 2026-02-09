"use client";

import { useEffect, useState } from 'react';
import AdminHeader from '@/components/admin/AdminHeader';
import LeadList from '@/components/admin/LeadList';
import BookingList from '@/components/admin/BookingList';
import PortalGrid from '@/components/admin/PortalGrid';
import { Plus } from 'lucide-react';

export default function AdminDashboard() {
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
                setLeads(await leadsRes.json());
                setBookings(await bookingsRes.json());
                setPortals(await portalsRes.json());
            } catch (error) {
                console.error("Failed to fetch admin data", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleCreatePortal = async () => {
        const name = prompt("Client Name:");
        if (!name) return;
        const email = prompt("Client Email:");
        if (!email) return;

        try {
            await fetch('/api/portals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientName: name, clientEmail: email })
            });
            window.location.reload();
        } catch (error) {
            alert("Failed to create portal");
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <div className="animate-pulse">Loading System Data...</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-black text-white selection:bg-[#d35400] selection:text-white pb-12">
            <AdminHeader />

            <main className="container mx-auto px-4 md:px-8 pt-28 space-y-8">
                {/* Top Section: Portals (Generous Space) */}
                <section>
                    <PortalGrid portals={portals} onCreateClick={handleCreatePortal} />
                </section>

                {/* Bottom Section: Leads & Bookings (Compact Lists) */}
                <section className="grid lg:grid-cols-2 gap-8 h-[600px]">
                    <LeadList leads={leads} />
                    <BookingList bookings={bookings} />
                </section>
            </main>
        </div>
    );
}
