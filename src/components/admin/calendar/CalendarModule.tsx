"use client";

import React, { useRef, useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Settings, Plus, Calendar as CalendarIcon, Check, X, Clock, CalendarDays, ChevronDown, ChevronRight, MapPin, AlignLeft, Briefcase, RefreshCw } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { Link } from "@/i18n/routing";

interface EventData {
    id: string;
    title: string;
    start: string;
    end?: string;
    allDay: boolean;
    backgroundColor?: string;
    borderColor?: string;
    url?: string;
    extendedProps?: any;
}

export default function CalendarModule() {
    const calendarRef = useRef<FullCalendar>(null);
    const [date, setDate] = useState<Date>(new Date());
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

    // Accounts & Calendars
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedCalendars, setSelectedCalendars] = useState<Set<string>>(new Set());
    const [portals, setPortals] = useState<any[]>([]);

    // Custom Events State
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newEvent, setNewEvent] = useState({
        id: '',
        title: '',
        start: '',
        end: '',
        allDay: false,
        description: '',
        location: '',
        createTask: false,
        portalId: '',
        calendarId: 'local',
        accountId: '',
        isGoogle: false
    });

    useEffect(() => {
        fetchAccounts();
        fetchPortals();
    }, []);

    const fetchAccounts = async () => {
        setIsLoadingAccounts(true);
        try {
            const res = await fetch('/api/calendar/accounts');
            if (res.ok) {
                const data = await res.json();
                setAccounts(data.accounts || []);

                // Select first calendar by default for each account
                const defaultSelected = new Set<string>();
                data.accounts?.forEach((acc: any) => {
                    if (acc.calendars && acc.calendars.length > 0) {
                        defaultSelected.add(acc.calendars[0].id);
                    }
                });
                setSelectedCalendars(defaultSelected);
            }
        } catch (e) {
            console.error("Failed to fetch accounts:", e);
        } finally {
            setIsLoadingAccounts(false);
        }
    };

    const fetchPortals = async () => {
        try {
            const res = await fetch('/api/calendar/portals');
            if (res.ok) {
                const data = await res.json();
                setPortals(data);
            }
        } catch (e) {
            console.error("Failed to fetch portals");
        }
    };

    const toggleCalendar = (calId: string) => {
        const next = new Set(selectedCalendars);
        if (next.has(calId)) next.delete(calId);
        else next.add(calId);
        setSelectedCalendars(next);

        // Refresh calendars
        if (calendarRef.current) {
            calendarRef.current.getApi().refetchEvents();
        }
    };

    // Handle Mini Calendar selection
    const handleDayClick = (day: Date) => {
        setDate(day);
        const calendarApi = calendarRef.current?.getApi();
        if (calendarApi) {
            calendarApi.gotoDate(day);
        }
    };

    // Handle FullCalendar Date Selection (Drag / Click)
    const handleDateSelect = (selectInfo: any) => {
        setNewEvent({
            id: '',
            title: '',
            start: selectInfo.startStr,
            end: selectInfo.endStr,
            allDay: selectInfo.allDay,
            description: '',
            location: '',
            createTask: false,
            portalId: '',
            calendarId: 'local',
            accountId: '',
            isGoogle: false
        });
        setIsEventModalOpen(true);
        selectInfo.view.calendar.unselect();
    };

    const handleSaveEvent = async () => {
        if (!newEvent.title.trim()) return;
        setIsSaving(true);

        const isGoogleAPI = newEvent.calendarId !== 'local';
        const apiUrl = isGoogleAPI ? '/api/calendar/google/events' : '/api/calendar/events';
        const method = newEvent.id ? 'PATCH' : 'POST';

        const body: any = { ...newEvent };
        if (isGoogleAPI) {
            body.eventId = newEvent.id;
        }

        try {
            const res = await fetch(apiUrl, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setIsEventModalOpen(false);
                calendarRef.current?.getApi().refetchEvents();
            } else {
                console.error("Failed to save event");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEvent = async () => {
        if (!newEvent.id) return;
        if (!confirm("Are you sure you want to delete this event?")) return;
        setIsSaving(true);

        const isGoogleAPI = newEvent.calendarId !== 'local';
        const apiUrl = isGoogleAPI
            ? `/ api / calendar / google / events ? eventId = ${encodeURIComponent(newEvent.id)}& calendarId=${encodeURIComponent(newEvent.calendarId)}& accountId=${encodeURIComponent(newEvent.accountId)} `
            : `/ api / calendar / events ? id = ${encodeURIComponent(newEvent.id)} `;

        try {
            const res = await fetch(apiUrl, { method: 'DELETE' });
            if (res.ok) {
                setIsEventModalOpen(false);
                calendarRef.current?.getApi().refetchEvents();
            }
        } catch (e) {
            console.error("Failed to delete event", e);
        } finally {
            setIsSaving(false);
        }
    };

    // FullCalendar Event Sources
    const eventSources: any[] = [
        {
            url: '/api/calendar/events',
            className: 'local-event'
        }
    ];

    // Add selected Google Calendars as functions
    accounts.forEach(acc => {
        acc.calendars?.forEach((cal: any) => {
            if (selectedCalendars.has(cal.id)) {
                eventSources.push({
                    events: async (info: any, successCallback: any, failureCallback: any) => {
                        try {
                            const res = await fetch(`/ api / calendar / google / events ? calendarId = ${encodeURIComponent(cal.id)}& accountId=${acc.accountId}& start=${info.startStr}& end=${info.endStr} `);
                            if (!res.ok) throw new Error("Failed");
                            const data = await res.json();
                            successCallback(data.map((e: any) => ({
                                ...e,
                                backgroundColor: cal.backgroundColor || '#3b82f6',
                                borderColor: cal.backgroundColor || '#3b82f6',
                                extendedProps: {
                                    ...e.extendedProps,
                                    calendarId: cal.id,
                                    accountId: acc.accountId,
                                    isGoogle: true
                                }
                            })));
                        } catch (e) {
                            failureCallback(e);
                        }
                    },
                    className: 'google-event'
                });
            }
        });
    });

    return (
        <div className="flex h-full min-h-[calc(100vh-8rem)] bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm relative">

            {/* Sidebar / Settings Area */}
            <div className={`w - 80 border - r border - neutral - 200 dark: border - white / 10 bg - neutral - 50 / 50 dark: bg - neutral - 900 / 20 flex flex - col transition - all duration - 300`}>
                <div className="p-5 border-b border-neutral-200 dark:border-white/10">
                    <button
                        onClick={() => {
                            const now = new Date();
                            setNewEvent({
                                id: '',
                                title: '',
                                start: now.toISOString(),
                                end: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
                                allDay: false,
                                description: '',
                                location: '',
                                createTask: false,
                                portalId: '',
                                calendarId: 'local',
                                accountId: '',
                                isGoogle: false
                            });
                            setIsEventModalOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all shadow-sm group"
                    >
                        <Plus className="w-5 h-5 text-neutral-500 group-hover:text-[#d35400] transition-colors" />
                        Create Event
                    </button>
                </div>

                <div className="p-4 flex flex-col flex-1 overflow-y-auto w-80 hide-scrollbar">
                    {/* Mini Calendar Apple-esque styling */}
                    <div className="mb-6 flex justify-center bg-white dark:bg-neutral-900/50 p-2 rounded-2xl border border-neutral-100 dark:border-white/5 shadow-sm">
                        <style dangerouslySetInnerHTML={{
                            __html: `
    .rdp {
    --rdp - cell - size: 34px;
    --rdp - accent - color: #d35400;
    --rdp - background - color: rgba(211, 84, 0, 0.1);
    margin: 0;
}
                            .rdp - day_selected, .rdp - day_selected: focus - visible, .rdp - day_selected:hover {
    color: white;
    opacity: 1;
    background - color: var(--rdp - accent - color);
}
                            .rdp - button: hover: not([disabled]): not(.rdp - day_selected) {
    background - color: rgba(211, 84, 0, 0.05);
    color: #d35400;
}
`}} />
                        <DayPicker
                            mode="single"
                            selected={date}
                            onSelect={(d) => d && handleDayClick(d)}
                            showOutsideDays
                        />
                    </div>

                    {/* Calendars List */}
                    <div className="space-y-1 mb-6">
                        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 px-2 flex items-center justify-between">
                            <span className="flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5" /> My Calendars</span>
                            <Link href="/admin/settings" className="p-1 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-md transition-colors text-neutral-400 hover:text-[#d35400]" title="Manage Integrations">
                                <Settings className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-100/50 dark:bg-white/5 cursor-pointer hover:bg-neutral-200/50 dark:hover:bg-white/10 transition-colors"
                            onClick={() => {
                                // Local events are always checked for now
                                calendarRef.current?.getApi().refetchEvents();
                            }}>
                            <div className="w-4 h-4 rounded appearance-none border border-neutral-300 dark:border-neutral-600 bg-[#d35400] flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-sm font-medium">Local Events</span>
                        </div>

                        {isLoadingAccounts ? (
                            <div className="px-3 py-2 text-xs text-neutral-500 flex items-center gap-2">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Loading accounts...
                            </div>
                        ) : accounts.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-neutral-500">No Google accounts connected.</div>
                        ) : (
                            accounts.map((acc, idx) => (
                                <div key={idx} className="mt-4">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2 px-2">
                                        {acc.email}
                                    </div>
                                    {acc.calendars?.map((cal: any) => (
                                        <div key={cal.id}
                                            onClick={() => toggleCalendar(cal.id)}
                                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-100/50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                                            <div className={`w - 4 h - 4 rounded border flex items - center justify - center transition - colors ${selectedCalendars.has(cal.id) ? 'border-transparent' : 'border-neutral-300 dark:border-neutral-600'} `}
                                                style={{ backgroundColor: selectedCalendars.has(cal.id) ? (cal.backgroundColor || '#3b82f6') : 'transparent' }}>
                                                {selectedCalendars.has(cal.id) && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="text-sm font-medium truncate" title={cal.summary}>{cal.summary}</span>
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Main Calendar Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-black rounded-r-2xl border-l border-neutral-200 dark:border-white/10">
                <div className="flex-1 p-6 overflow-hidden calendar-container">
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="timeGridWeek"
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'dayGridMonth,timeGridWeek,timeGridDay'
                        }}
                        eventSources={eventSources}
                        height="100%"
                        editable={true}
                        selectable={true}
                        selectMirror={true}
                        dayMaxEvents={false} /* Do not trim the list */
                        allDaySlot={true} /* Put all-day events on top of the day page */
                        nowIndicator={true}
                        select={handleDateSelect}
                        eventClick={(info) => {
                            if (info.event.url) {
                                window.open(info.event.url, '_blank', 'noopener,noreferrer');
                                info.jsEvent.preventDefault();
                            } else {
                                const props = info.event.extendedProps;
                                setNewEvent({
                                    id: info.event.id,
                                    title: info.event.title,
                                    start: info.event.start?.toISOString() || '',
                                    end: info.event.end?.toISOString() || info.event.start?.toISOString() || '',
                                    allDay: info.event.allDay,
                                    description: props.description || '',
                                    location: props.location || '',
                                    createTask: false,
                                    portalId: '',
                                    calendarId: props.calendarId || 'local',
                                    accountId: props.accountId || '',
                                    isGoogle: !!props.isGoogle
                                });
                                setIsEventModalOpen(true);
                            }
                        }}
                        datesSet={(arg) => {
                            setDate(arg.view.currentStart);
                        }}
                    />
                </div>
            </div>

            {/* Custom Event Creation Modal */}
            {isEventModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 w-full max-w-xl rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-800/50">
                            <h3 className="font-semibold text-lg text-neutral-900 dark:text-white">{newEvent.id ? 'Edit Event' : 'New Event'}</h3>
                            <button onClick={() => setIsEventModalOpen(false)} className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                                <X className="w-5 h-5 text-neutral-500" />
                            </button>
                        </div>

                        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div>
                                <input
                                    type="text"
                                    placeholder="Add title"
                                    className="w-full text-2xl font-medium px-0 py-2 bg-transparent border-b-2 border-transparent focus:border-[#d35400] focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600 transition-colors"
                                    value={newEvent.title}
                                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-4">
                                {/* Time selection */}
                                <div className="flex items-center gap-4 text-sm text-neutral-700 dark:text-neutral-300">
                                    <Clock className="w-5 h-5 text-neutral-400" />
                                    <div className="flex gap-2 items-center flex-1">
                                        <input
                                            type={newEvent.allDay ? "date" : "datetime-local"}
                                            className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#d35400] rounded-md outline-none transition-colors"
                                            value={newEvent.start ? newEvent.start.slice(0, newEvent.allDay ? 10 : 16) : ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (!val) return;
                                                const iso = newEvent.allDay ? `${val} T00:00:00.000Z` : new Date(val).toISOString();
                                                setNewEvent({ ...newEvent, start: iso });
                                            }}
                                        />
                                        <span>to</span>
                                        <input
                                            type={newEvent.allDay ? "date" : "datetime-local"}
                                            className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[#d35400] rounded-md outline-none transition-colors"
                                            value={newEvent.end ? newEvent.end.slice(0, newEvent.allDay ? 10 : 16) : ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (!val) return;
                                                const iso = newEvent.allDay ? `${val} T00:00:00.000Z` : new Date(val).toISOString();
                                                setNewEvent({ ...newEvent, end: iso });
                                            }}
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 text-xs whitespace-nowrap min-w-fit">
                                        <input type="checkbox" checked={newEvent.allDay} onChange={(e) => setNewEvent({ ...newEvent, allDay: e.target.checked })} className="accent-[#d35400]" />
                                        All day
                                    </label>
                                </div>

                                {/* Calendar Selection */}
                                <div className="flex items-center gap-4 text-sm text-neutral-700 dark:text-neutral-300">
                                    <CalendarIcon className="w-5 h-5 text-neutral-400" />
                                    <select
                                        className="flex-1 px-3 py-1.5 bg-transparent border border-neutral-200 dark:border-neutral-700 focus:border-[#d35400] rounded-md outline-none transition-colors"
                                        value={newEvent.calendarId === 'local' ? 'local' : `${newEvent.accountId}| ${newEvent.calendarId} `}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'local') {
                                                setNewEvent({ ...newEvent, calendarId: 'local', accountId: '', isGoogle: false });
                                            } else {
                                                const [accId, calId] = val.split('|');
                                                setNewEvent({ ...newEvent, calendarId: calId, accountId: accId, isGoogle: true });
                                            }
                                        }}
                                        disabled={!!newEvent.id} // Don't allow moving existing events between calendars
                                    >
                                        <option value="local">Local Admin Calendar</option>
                                        {accounts.map(acc => (
                                            <optgroup key={acc.accountId} label={acc.email}>
                                                {acc.calendars?.map((cal: any) => (
                                                    <option key={cal.id} value={`${acc.accountId}| ${cal.id} `}>{cal.summary}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>

                                {/* Location */}
                                <div className="flex items-center gap-4 text-sm text-neutral-700 dark:text-neutral-300">
                                    <MapPin className="w-5 h-5 text-neutral-400" />
                                    <input
                                        type="text"
                                        placeholder="Add location"
                                        className="flex-1 px-3 py-1.5 bg-transparent border border-neutral-200 dark:border-neutral-700 focus:border-[#d35400] rounded-md outline-none transition-colors"
                                        value={newEvent.location}
                                        onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                                    />
                                </div>

                                {/* Description */}
                                <div className="flex items-start gap-4 text-sm text-neutral-700 dark:text-neutral-300">
                                    <AlignLeft className="w-5 h-5 text-neutral-400 mt-1.5" />
                                    <textarea
                                        placeholder="Add description"
                                        rows={3}
                                        className="flex-1 px-3 py-2 bg-transparent border border-neutral-200 dark:border-neutral-700 focus:border-[#d35400] rounded-md outline-none transition-colors resize-none"
                                        value={newEvent.description}
                                        onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                                    />
                                </div>

                                {/* Link to Task Creation (Available for both Local and Google Events) */}
                                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className={`w - 4 h - 4 rounded border flex items - center justify - center transition - colors ${newEvent.createTask ? 'bg-[#d35400] border-[#d35400]' : 'border-neutral-300 dark:border-neutral-600 group-hover:border-[#d35400]'} `}>
                                            {newEvent.createTask && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Create associated Task</span>
                                    </label>

                                    {newEvent.createTask && (
                                        <div className="mt-3 ml-7 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                            <Briefcase className="w-4 h-4 text-neutral-400" />
                                            <select
                                                className="flex-1 px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md outline-none focus:border-[#d35400]"
                                                value={newEvent.portalId}
                                                onChange={(e) => setNewEvent({ ...newEvent, portalId: e.target.value })}
                                            >
                                                <option value="" disabled>Select a Client Portal</option>
                                                {portals.map(p => (
                                                    <option key={p.id} value={p.id}>{p.clientName} {p.projectTitle ? `(${p.projectTitle})` : ''}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-4 border-t border-neutral-100 dark:border-white/5 flex justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-800/50">
                            <div>
                                {newEvent.id && (
                                    <button
                                        onClick={handleDeleteEvent}
                                        disabled={isSaving}
                                        className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsEventModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEvent}
                                    disabled={isSaving || !newEvent.title.trim() || (newEvent.createTask && !newEvent.portalId) || !newEvent.start}
                                    className="px-5 py-2 text-sm font-medium bg-[#d35400] hover:bg-[#e67e22] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-sm flex items-center gap-2"
                                >
                                    {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    {newEvent.id ? 'Save Changes' : 'Save Event'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Apple/Google Calendar CSS Overrides */}
            <style dangerouslySetInnerHTML={{
                __html: `
    .calendar - container.fc {
    --fc - border - color: rgba(0, 0, 0, 0.06);
    --fc - button - text - color: #525252;
    --fc - button - bg - color: #fff;
    --fc - button - border - color: rgba(0, 0, 0, 0.1);
    --fc - button - hover - bg - color: #f5f5f5;
    --fc - button - hover - border - color: rgba(0, 0, 0, 0.2);
    --fc - button - active - bg - color: #fef3c7;
    --fc - button - active - border - color: #d35400;
    --fc - button - active - text - color: #d35400;
    --fc - today - bg - color: rgba(211, 84, 0, 0.03);
    --fc - now - indicator - color: #ef4444;
    font - family: inherit;
}

        .calendar - container.fc.fc - toolbar - title {
    font - size: 1.25rem;
    font - weight: 600;
    color: #171717;
}

        .calendar - container.fc.fc - col - header - cell {
    padding: 8px 0;
    font - weight: 500;
    text - transform: uppercase;
    font - size: 0.75rem;
    color: #737373;
    border - bottomWidth: 1px;
}

        .calendar - container.fc - theme - standard.fc - scrollgrid {
    border: none;
}

        .calendar - container.fc - theme - standard th {
    border - top: none;
    border - left: none;
    border - right: none;
}

        .calendar - container.fc.fc - timegrid - now - indicator - arrow {
    border - width: 5px;
    border - radius: 5px;
    border - color: var(--fc - now - indicator - color);
    margin - top: -5px;
}
        .calendar - container.fc.fc - timegrid - now - indicator - line {
    border - top - width: 2px;
}

        .calendar - container.fc - event {
    border - radius: 6px;
    padding: 3px 6px;
    border: none;
    font - size: 0.75rem;
    font - weight: 500;
    box - shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    transition: transform 0.1s ease, box - shadow 0.1s ease;
}
        
        .calendar - container.fc - event:hover {
    transform: translateY(-1px);
    box - shadow: 0 4px 6px - 1px rgba(0, 0, 0, 0.1), 0 2px 4px - 1px rgba(0, 0, 0, 0.06);
    z - index: 10!important;
}

        .calendar - container.local - event {
    background - color: #d35400;
    border - color: #d35400;
}

        .calendar - container.fc - timegrid - event.fc - event - main {
    padding: 2px;
}

        .calendar - container.fc.fc - button {
    border - radius: 8px;
    padding: 0.4rem 0.8rem;
    font - size: 0.875rem;
    font - weight: 500;
    text - transform: capitalize;
    transition: all 0.2s;
}
        .calendar - container.fc.fc - button - primary: not(: disabled).fc - button - active, 
        .calendar - container.fc.fc - button - primary: not(: disabled):active {
    background - color: rgba(211, 84, 0, 0.1);
    border - color: rgba(211, 84, 0, 0.2);
    color: #d35400;
    box - shadow: none;
}

@media(prefers - color - scheme: dark) {
          .calendar - container.fc {
        --fc - border - color: rgba(255, 255, 255, 0.08);
        --fc - button - text - color: #a3a3a3;
        --fc - button - bg - color: #171717;
        --fc - button - border - color: rgba(255, 255, 255, 0.1);
        --fc - button - hover - bg - color: #262626;
        --fc - button - hover - border - color: rgba(255, 255, 255, 0.2);
        --fc - page - bg - color: transparent;
        --fc - neutral - bg - color: rgba(255, 255, 255, 0.02);
        --fc - today - bg - color: rgba(211, 84, 0, 0.1);
    }
          
          .calendar - container.fc.fc - toolbar - title {
        color: #fff;
    }

          .calendar - container.fc.fc - daygrid - day - number,
          .calendar - container.fc.fc - col - header - cell - cushion {
        color: #d4d4d4;
    }
}
        
        .hide - scrollbar:: -webkit - scrollbar {
    display: none;
}
        .hide - scrollbar {
    -ms - overflow - style: none;
    scrollbar - width: none;
}

        .custom - scrollbar:: -webkit - scrollbar {
    width: 6px;
}
        .custom - scrollbar:: -webkit - scrollbar - track {
    background: transparent;
}
        .custom - scrollbar:: -webkit - scrollbar - thumb {
    background - color: rgba(0, 0, 0, 0.1);
    border - radius: 10px;
}
        .dark.custom - scrollbar:: -webkit - scrollbar - thumb {
    background - color: rgba(255, 255, 255, 0.1);
}
`}} />
        </div>
    );
}
