"use client";

import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useDatabaseStore } from '@/components/admin/database/store';
import { cn } from '@/components/time-tracker/lib/utils';
import { Property } from '@/components/admin/database/types';
import { useRouter } from 'next/navigation';

interface CalendarViewProps {
    databaseId: string;
    viewId: string;
}

export default function CalendarView({ databaseId, viewId }: CalendarViewProps) {
    const database = useDatabaseStore(state => state.getDatabase(databaseId));
    const router = useRouter();

    if (!database) return null;

    const view = database.views.find(v => v.id === viewId);
    let datePropertyId = view?.config?.datePropertyId;

    // If no specific date property is configured, find the first available date property
    if (!datePropertyId) {
        const firstDateProp = database.properties.find(p => p.type === 'date');
        if (firstDateProp) {
            datePropertyId = firstDateProp.id;
        }
    }

    if (!datePropertyId) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-neutral-500">
                <p className="mb-2">This calendar view requires a "Date" property.</p>
                <p className="text-sm opacity-80">Please add a Date property to your database to use the calendar.</p>
            </div>
        );
    }

    // Map database pages to FullCalendar Event Objects
    const calendarEvents = database.pages.map(page => {
        const title = page.properties['title'] as string || 'Untitled';
        const dateValue = page.properties[datePropertyId!] as string;

        // Try to get a color from a priority or status tag if available to make it look nice
        const statusProp = database.properties.find(p => p.type === 'select' || p.type === 'multi_select');
        let color = '#3b82f6'; // Default blue
        if (statusProp) {
            const val = page.properties[statusProp.id];
            const opt = statusProp.config?.options?.find(o =>
                Array.isArray(val) ? val.includes(o.id) : o.id === val
            );
            if (opt) {
                // Map logical colors to hex for FullCalendar
                const hexMap: Record<string, string> = {
                    red: '#ef4444', orange: '#f97316', yellow: '#eab308',
                    green: '#22c55e', blue: '#3b82f6', purple: '#a855f7',
                    pink: '#ec4899', gray: '#6b7280', brown: '#92400e'
                };
                color = hexMap[opt.color] || color;
            }
        }

        if (!dateValue) return null; // Skip if no date set

        return {
            id: page.id,
            title: title,
            start: new Date(dateValue).toISOString(),
            allDay: true, // simplified for now
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
                pageId: page.id
            }
        };
    }).filter(Boolean) as any[];


    // Handle clicking a calendar event (e.g. open the Notion side-peek)
    const handleEventClick = (info: any) => {
        // You would typically trigger the side-peek modal here.
        // For demonstration, we've kept the UI simple. Next logic would go here.
        console.log("Clicked Database Page:", info.event.extendedProps.pageId);
    };

    return (
        <div className="w-full h-full p-6 bg-white dark:bg-black overflow-y-auto no-scrollbar styled-calendar">
            <style jsx global>{`
                .styled-calendar .fc {
                    font-family: inherit;
                    --fc-border-color: rgba(0,0,0,0.1);
                    --fc-page-bg-color: transparent;
                }
                .dark .styled-calendar .fc {
                    --fc-border-color: rgba(255,255,255,0.1);
                }
                .styled-calendar .fc .fc-toolbar-title {
                    font-size: 1.125rem;
                    font-weight: 600;
                    letter-spacing: -0.025em;
                }
                .styled-calendar .fc .fc-button-primary {
                    background-color: var(--fc-border-color);
                    border-color: transparent;
                    color: inherit;
                    text-transform: capitalize;
                }
                .styled-calendar .fc .fc-button-primary:hover {
                    background-color: rgba(0,0,0,0.2);
                }
                .dark .styled-calendar .fc .fc-button-primary:hover {
                    background-color: rgba(255,255,255,0.2);
                }
                .styled-calendar .fc-theme-standard td, 
                .styled-calendar .fc-theme-standard th {
                    border-color: var(--fc-border-color);
                }
                .styled-calendar .fc-event {
                    border-radius: 4px;
                    padding: 2px 4px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: opacity 0.2s;
                    border: none;
                }
                .styled-calendar .fc-event:hover {
                    opacity: 0.8;
                }
            `}</style>

            <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                events={calendarEvents}
                eventClick={handleEventClick}
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,dayGridWeek'
                }}
                height="auto"
                aspectRatio={1.35}
                firstDay={1} // Monday start
                buttonText={{
                    today: 'Today',
                    month: 'Month',
                    week: 'Week'
                }}
            />
        </div>
    );
}
