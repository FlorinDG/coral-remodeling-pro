import { useEffect, useState } from 'react';
import LeadList from '@/components/admin/LeadList';
import BookingList from '@/components/admin/BookingList';
import PortalGrid from '@/components/admin/PortalGrid';
import CreatePortalModal from '@/components/admin/CreatePortalModal';
import { useTranslations } from 'next-intl';

export default function PortalsPage() {
    const t = useTranslations('Admin');
    const [leads, setLeads] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [portals, setPortals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const fetchData = async () => {
        try {
            const [leadsRes, bookingsRes, portalsRes] = await Promise.all([
                fetch('/api/leads'),
                fetch('/api/bookings'),
                fetch('/api/portals')
            ]);

            const parseSafe = async (res: Response) => {
                if (!res.ok) return [];
                try { return await res.json(); } catch { return []; }
            };

            setLeads(await parseSafe(leadsRes));
            setBookings(await parseSafe(bookingsRes));
            setPortals(await parseSafe(portalsRes));
        } catch (error) {
            console.error("Failed to fetch admin data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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

            <section>
                <PortalGrid portals={portals} onCreateClick={() => setIsCreateModalOpen(true)} />
            </section>

            <section className="grid lg:grid-cols-2 gap-8 h-[600px]">
                <LeadList leads={leads} />
                <BookingList bookings={bookings} />
            </section>

            <CreatePortalModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchData}
            />
        </div>
    );
}
