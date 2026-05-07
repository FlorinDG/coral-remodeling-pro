"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import toast, { Toaster } from 'react-hot-toast';
import { Settings, Plus, Calendar as CalendarIcon, Check, X, Clock, CalendarDays, ChevronDown, ChevronRight, MapPin, AlignLeft, Briefcase, RefreshCw } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { Link, useRouter } from "@/i18n/routing";
import { useCalendarStore } from './store';
import { useDatabaseStore } from '../database/store';
import { enGB } from 'date-fns/locale';
import { createPageServerFirst } from '@/app/actions/pages';
import { useTenant } from '@/context/TenantContext';
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
    const { resolveDbId } = useTenant();
    const tasksDbId = resolveDbId('db-tasks');

    const calendarRef = useRef<FullCalendar>(null);
    const router = useRouter();
    const [date, setDate] = useState<Date>(new Date());
    const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Global Store State
    const { accounts, portals, isLoadingAccounts, fetchAccounts, fetchPortals } = useCalendarStore();

    // Local UI State
    const [selectedCalendars, setSelectedCalendars] = useState<Set<string>>(new Set());

    // Custom Events State
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [taskData, setTaskData] = useState({
        title: '',
        dueDate: '',
        priority: 'opt-med'
    });
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
        isGoogle: false,
        oldCalendarId: '',
        oldAccountId: ''
    });

    useEffect(() => {
        // Hydrate from network in background
        fetchAccounts().then(() => {
            // Select first calendar by default for each account exactly once to avoid batch flashes
            const currentAccounts = useCalendarStore.getState().accounts;
            if (currentAccounts && currentAccounts.length > 0) {
                setSelectedCalendars(prev => {
                    const next = new Set(prev);
                    let changed = false;
                    currentAccounts.forEach((acc: any) => {
                        if (acc.calendars && acc.calendars.length > 0) {
                            if (!next.has(acc.calendars[0].id)) {
                                next.add(acc.calendars[0].id);
                                changed = true;
                            }
                        }
                    });
                    return changed ? next : prev;
                });
            }
        });
        fetchPortals();
    }, [fetchAccounts, fetchPortals]);

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
        setCalendarMonth(day);
        const calendarApi = calendarRef.current?.getApi();
        if (calendarApi) {
            calendarApi.gotoDate(day);
        }
    };

    // Handle FullCalendar Date Selection (Drag / Click)
    const handleDateSelect = useCallback((selectInfo: any) => {
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
            isGoogle: false,
            oldCalendarId: '',
            oldAccountId: ''
        });
        setIsEventModalOpen(true);
        selectInfo.view.calendar.unselect();
    }, []);

    const handleSaveEvent = async () => {
        if (!newEvent.title.trim()) return;
        setIsSaving(true);

        const apiUrl = '/api/calendar/events';
        const method = newEvent.id ? 'PATCH' : 'POST';

        const body: any = { ...newEvent };

        try {
            const res = await fetch(apiUrl, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                // If the user requested an associated task and this is a NEW event
                if (newEvent.createTask && !newEvent.id) {
                    // Server-first task creation (static import, no dynamic import needed)
                    createPageServerFirst(tasksDbId, {
                        'title': `[Event Task] ${newEvent.title}`,
                        'prop-task-due': newEvent.start.split('T')[0],
                        'prop-task-priority': 'opt-med',
                        'prop-task-status': 'opt-todo'
                    }).then(result => {
                        if (result.success) useDatabaseStore.getState().addConfirmedPage(result.page);
                    });
                    toast.success('Event and Task created successfully!');
                } else {
                    toast.success('Event saved successfully!');
                }

                setIsEventModalOpen(false);
                calendarRef.current?.getApi().refetchEvents();

                // Reset form state so it doesn't try to reuse stale data
                setNewEvent({
                    id: '', title: '', start: '', end: '', allDay: false, description: '', location: '', createTask: false, portalId: '', calendarId: 'local', accountId: '', isGoogle: false, oldCalendarId: '', oldAccountId: ''
                });
            } else {
                console.error("Failed to save event");
                toast.error('Failed to save event. Check connection.');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred while saving.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEvent = async () => {
        if (!newEvent.id) return;
        if (!confirm("Are you sure you want to delete this event?")) return;
        setIsSaving(true);

        const apiUrl = `/api/calendar/events?id=${encodeURIComponent(newEvent.id)}` +
            (newEvent.accountId ? `&accountId=${encodeURIComponent(newEvent.accountId)}` : '');

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
    const eventSources = useMemo(() => {
        return [{
            events: async (info: any, successCallback: any, failureCallback: any) => {
                try {
                    const res = await fetch('/api/calendar/events');
                    if (!res.ok) throw new Error("Failed");
                    let data = await res.json();

                    data = data.map((e: any) => {
                        const calId = e.extendedProps?.googleCalendarId;
                        let isGoogle = false;
                        let bgColor = 'var(--brand-color, #d35400)'; // local color
                        let accId = '';

                        if (calId) {
                            // Find the google account and calendar to assign color
                            accounts.forEach(acc => {
                                acc.calendars?.forEach((cal: any) => {
                                    if (cal.id === calId) {
                                        isGoogle = true;
                                        bgColor = cal.backgroundColor || '#3b82f6';
                                        accId = acc.accountId;
                                    }
                                });
                            });
                        }

                        // For local events, we always render them.
                        // For Google events, we only render if their calendar is selected in the UI hook.
                        if (isGoogle && !selectedCalendars.has(calId)) {
                            return null;
                        }

                        return {
                            ...e,
                            className: isGoogle ? 'google-event' : 'local-event',
                            backgroundColor: isGoogle ? bgColor : undefined,
                            borderColor: isGoogle ? bgColor : undefined,
                            extendedProps: {
                                ...e.extendedProps,
                                isGoogle,
                                accountId: accId
                            }
                        };
                    }).filter(Boolean); // remove unchecked calendars

                    successCallback(data);
                } catch (e) {
                    failureCallback(e);
                }
            }
        }];
    }, [accounts, selectedCalendars]);

    const renderCalendar = useMemo(() => {
        return (
            <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                initialView="timeGridWeek"
                weekNumbers={true}
                firstDay={1}
                locale="en-gb"
                slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                dayHeaderFormat={{ weekday: 'short', day: '2-digit', month: '2-digit', omitCommas: true }}
                customButtons={{
                    toggleSidebar: {
                        text: '☰',
                        click: () => setIsSidebarOpen(prev => !prev),
                    },
                    createEvent: {
                        text: '+ Create Event',
                        click: () => {
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
                                isGoogle: false,
                                oldCalendarId: '',
                                oldAccountId: ''
                            });
                            setIsEventModalOpen(true);
                        }
                    },
                    refreshEvents: {
                        text: '↻ Sync',
                        click: async () => {
                            const toastId = toast.loading('Syncing calendars...');
                            try {
                                const res = await fetch('/api/calendar/sync', { method: 'POST' });
                                if (res.ok) {
                                    calendarRef.current?.getApi().refetchEvents();
                                    toast.success('Calendar synced successfully!', { id: toastId });
                                } else {
                                    throw new Error("Sync failed");
                                }
                            } catch (err) {
                                console.error(err);
                                toast.error('Failed to sync. Check connection.', { id: toastId });
                            }
                        }
                    },
                    createTask: {
                        text: '+ Create Task',
                        click: () => {
                            setTaskData({ title: '', dueDate: new Date().toISOString().split('T')[0], priority: 'opt-med' });
                            setIsTaskModalOpen(true);
                        }
                    }
                }}
                headerToolbar={{
                    left: 'toggleSidebar prev,next today',
                    center: 'title',
                    right: 'refreshEvents createEvent createTask dayGridMonth,timeGridWeek,timeGridDay'
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
                            calendarId: props.googleCalendarId || 'local',
                            accountId: props.accountId || '',
                            isGoogle: !!props.isGoogle,
                            oldCalendarId: props.googleCalendarId || 'local',
                            oldAccountId: props.accountId || ''
                        });
                        setIsEventModalOpen(true);
                    }
                }}
                datesSet={(arg) => {
                    const api = calendarRef.current?.getApi();
                    if (api) {
                        setCalendarMonth(api.getDate());
                    } else {
                        setCalendarMonth(arg.view.currentStart);
                    }
                }}
            />
        );
    }, [eventSources, handleDateSelect]);

    return (
        <div className="flex h-full min-h-[calc(100vh-8rem)] bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm relative">
            <Toaster position="top-right" />
            {/* Sidebar / Settings Area */}
            <div className={`border-r border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-neutral-900/20 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden border-r-0'}`}>

                <div className="p-4 flex flex-col flex-1 overflow-y-auto w-80 hide-scrollbar pt-6">
                    {/* Mini Calendar Apple-esque styling */}
                    <div className="mb-6 flex justify-center bg-white dark:bg-neutral-900/50 p-2 rounded-2xl border border-neutral-100 dark:border-white/5 shadow-sm">
                        <style dangerouslySetInnerHTML={{
                            __html: `
                            .rdp {
                                --rdp-cell-size: 34px;
                                --rdp-accent-color: var(--brand-color, #d35400);
                                --rdp-background-color: rgba(211, 84, 0, 0.1);
                                margin: 0;
                            }
                            .rdp-day_selected, .rdp-day_selected:focus-visible, .rdp-day_selected:hover {
                                color: white;
                                opacity: 1;
                                background-color: var(--rdp-accent-color);
                            }
                            .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                                background-color: rgba(211, 84, 0, 0.05);
                                color: var(--brand-color, #d35400);
                            }
                        `}} />
                        <DayPicker
                            mode="single"
                            selected={date}
                            month={calendarMonth}
                            onMonthChange={setCalendarMonth}
                            onSelect={(d) => d && handleDayClick(d)}
                            showOutsideDays
                            weekStartsOn={1}
                            locale={enGB}
                        />
                    </div>

                    {/* Calendars List */}
                    <div className="space-y-1 mb-6">
                        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 px-2 flex items-center justify-between">
                            <span className="flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5" /> My Calendars</span>
                            <Link href="/admin/settings" className="p-1 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-md transition-colors text-neutral-400 hover:text-[var(--brand-color,var(--brand-color, #d35400))]" title="Manage Integrations">
                                <Settings className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-100/50 dark:bg-white/5 cursor-pointer hover:bg-neutral-200/50 dark:hover:bg-white/10 transition-colors"
                            onClick={() => {
                                // Local events are always checked for now
                                calendarRef.current?.getApi().refetchEvents();
                            }}>
                            <div className="w-4 h-4 rounded appearance-none border border-neutral-300 dark:border-neutral-600 bg-[var(--brand-color,var(--brand-color, #d35400))] flex items-center justify-center">
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
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedCalendars.has(cal.id) ? 'border-transparent' : 'border-neutral-300 dark:border-neutral-600'}`}
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
                    {renderCalendar}
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
                                    className="w-full text-2xl font-medium px-0 py-2 bg-transparent border-b-2 border-transparent focus:border-[var(--brand-color,var(--brand-color, #d35400))] focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600 transition-colors"
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
                                            className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[var(--brand-color,var(--brand-color, #d35400))] rounded-md outline-none transition-colors"
                                            value={newEvent.start ? newEvent.start.slice(0, newEvent.allDay ? 10 : 16) : ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (!val) return;
                                                if (newEvent.allDay) {
                                                    setNewEvent({ ...newEvent, start: `${val}T00:00:00.000Z` });
                                                } else {
                                                    // Preserve local time by not using native UTC parsing
                                                    const localDate = new Date(val);
                                                    const offset = localDate.getTimezoneOffset() * 60000;
                                                    const iso = new Date(localDate.getTime() - offset).toISOString().slice(0, -1);
                                                    setNewEvent({ ...newEvent, start: `${iso}Z` });
                                                }
                                            }}
                                        />
                                        <span>to</span>
                                        <input
                                            type={newEvent.allDay ? "date" : "datetime-local"}
                                            className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-[var(--brand-color,var(--brand-color, #d35400))] rounded-md outline-none transition-colors"
                                            value={newEvent.end ? newEvent.end.slice(0, newEvent.allDay ? 10 : 16) : ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (!val) return;
                                                if (newEvent.allDay) {
                                                    setNewEvent({ ...newEvent, end: `${val}T00:00:00.000Z` });
                                                } else {
                                                    // Preserve local time
                                                    const localDate = new Date(val);
                                                    const offset = localDate.getTimezoneOffset() * 60000;
                                                    const iso = new Date(localDate.getTime() - offset).toISOString().slice(0, -1);
                                                    setNewEvent({ ...newEvent, end: `${iso}Z` });
                                                }
                                            }}
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 text-xs whitespace-nowrap min-w-fit">
                                        <input type="checkbox" checked={newEvent.allDay} onChange={(e) => setNewEvent({ ...newEvent, allDay: e.target.checked })} className="accent-[var(--brand-color, #d35400)]" />
                                        All day
                                    </label>
                                </div>

                                {/* Calendar Selection */}
                                <div className="flex items-center gap-4 text-sm text-neutral-700 dark:text-neutral-300">
                                    <CalendarIcon className="w-5 h-5 text-neutral-400" />
                                    <select
                                        className="flex-1 px-3 py-1.5 bg-transparent border border-neutral-200 dark:border-neutral-700 focus:border-[var(--brand-color,var(--brand-color, #d35400))] rounded-md outline-none transition-colors"
                                        value={newEvent.calendarId === 'local' ? 'local' : `${newEvent.accountId}|${newEvent.calendarId}`}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'local') {
                                                setNewEvent({ ...newEvent, calendarId: 'local', accountId: '', isGoogle: false });
                                            } else {
                                                const [accId, calId] = val.split('|');
                                                setNewEvent({ ...newEvent, calendarId: calId, accountId: accId, isGoogle: true });
                                            }
                                        }}
                                    >
                                        <option value="local">Local Admin Calendar</option>
                                        {accounts.map(acc => (
                                            <optgroup key={acc.accountId} label={acc.email}>
                                                {acc.calendars?.map((cal: any) => (
                                                    <option key={cal.id} value={`${acc.accountId}|${cal.id}`}>{cal.summary}</option>
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
                                        className="flex-1 px-3 py-1.5 bg-transparent border border-neutral-200 dark:border-neutral-700 focus:border-[var(--brand-color,var(--brand-color, #d35400))] rounded-md outline-none transition-colors"
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
                                        className="flex-1 px-3 py-2 bg-transparent border border-neutral-200 dark:border-neutral-700 focus:border-[var(--brand-color,var(--brand-color, #d35400))] rounded-md outline-none transition-colors resize-none"
                                        value={newEvent.description}
                                        onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                                    />
                                </div>

                                {/* Link to Task Creation (Available for both Local and Google Events) */}
                                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                                    <label className="flex items-center gap-3 cursor-pointer group" onClick={(e) => { e.preventDefault(); setNewEvent({ ...newEvent, createTask: !newEvent.createTask }); }}>
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${newEvent.createTask ? 'bg-[var(--brand-color,#d35400)] border-[var(--brand-color,#d35400)]' : 'border-neutral-300 dark:border-neutral-600 group-hover:border-[var(--brand-color,var(--brand-color, #d35400))]'}`}>
                                            {newEvent.createTask && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Create associated Task</span>
                                    </label>

                                    {newEvent.createTask && (
                                        <div className="mt-3 ml-7 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                            <Briefcase className="w-4 h-4 text-neutral-400" />
                                            <select
                                                className="flex-1 px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md outline-none focus:border-[var(--brand-color,var(--brand-color, #d35400))]"
                                                value={newEvent.portalId}
                                                onChange={(e) => setNewEvent({ ...newEvent, portalId: e.target.value })}
                                            >
                                                <option value="">No Client Portal (Admin Task Only)</option>
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
                                    disabled={isSaving || !newEvent.title.trim() || !newEvent.start}
                                    className="px-5 py-2 text-sm font-medium bg-[var(--brand-color,var(--brand-color, #d35400))] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-sm flex items-center gap-2"
                                >
                                    {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    {newEvent.id ? 'Save Changes' : 'Save Event'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Standalone Task Creation Modal */}
            {isTaskModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-800/50">
                            <h3 className="font-semibold text-lg text-neutral-900 dark:text-white">New Task</h3>
                            <button onClick={() => setIsTaskModalOpen(false)} className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                                <X className="w-5 h-5 text-neutral-500" />
                            </button>
                        </div>

                        <div className="p-5 space-y-5">
                            <div>
                                <input
                                    type="text"
                                    placeholder="Task Title"
                                    className="w-full text-lg font-medium px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border-2 border-transparent focus:bg-white focus:border-[var(--brand-color,var(--brand-color, #d35400))] rounded-lg outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600 transition-colors"
                                    value={taskData.title}
                                    onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Due Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border-2 border-transparent focus:bg-white focus:border-[var(--brand-color,var(--brand-color, #d35400))] rounded-lg outline-none text-sm transition-colors"
                                        value={taskData.dueDate}
                                        onChange={(e) => setTaskData({ ...taskData, dueDate: e.target.value })}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Priority</label>
                                    <select
                                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border-2 border-transparent focus:bg-white focus:border-[var(--brand-color,var(--brand-color, #d35400))] rounded-lg outline-none text-sm transition-colors"
                                        value={taskData.priority}
                                        onChange={(e) => setTaskData({ ...taskData, priority: e.target.value })}
                                    >
                                        <option value="opt-high">High</option>
                                        <option value="opt-med">Medium</option>
                                        <option value="opt-low">Low</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-4 border-t border-neutral-100 dark:border-white/5 flex gap-3 justify-end bg-neutral-50/50 dark:bg-neutral-800/50">
                            <button
                                onClick={() => setIsTaskModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={!taskData.title.trim()}
                                className="px-5 py-2 text-sm font-medium bg-[var(--brand-color,var(--brand-color, #d35400))] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-sm"
                                onClick={async () => {
                                    if (taskData.title.trim()) {
                                        const result = await createPageServerFirst(tasksDbId, {
                                            'title': taskData.title,
                                            'prop-task-due': taskData.dueDate,
                                            'prop-task-priority': taskData.priority,
                                            'prop-task-status': 'opt-todo'
                                        });
                                        if (result.success) {
                                            useDatabaseStore.getState().addConfirmedPage(result.page);
                                        }
                                        toast.success('Task created successfully!');
                                        setIsTaskModalOpen(false);
                                        setTaskData({ title: '', dueDate: new Date().toISOString().split('T')[0], priority: 'opt-med' });
                                    }
                                }}
                            >
                                Create Task
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Premium Apple/Google Calendar CSS Overrides */}
            <style dangerouslySetInnerHTML={{
                __html: `
    .calendar-container.fc {
        --fc-border-color: rgba(0, 0, 0, 0.06);
        --fc-button-text-color: #525252;
        --fc-button-bg-color: #fff;
        --fc-button-border-color: rgba(0, 0, 0, 0.1);
        --fc-button-hover-bg-color: #f5f5f5;
        --fc-button-hover-border-color: rgba(0, 0, 0, 0.2);
        --fc-button-active-bg-color: #fef3c7;
        --fc-button-active-border-color: var(--brand-color, #d35400);
        --fc-button-active-text-color: var(--brand-color, #d35400);
        --fc-today-bg-color: rgba(211, 84, 0, 0.03);
        --fc-now-indicator-color: #ef4444;
        font-family: inherit;
    }

    .calendar-container.fc .fc-toolbar-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #171717;
    }

    .calendar-container.fc .fc-col-header-cell {
        padding: 8px 0;
        font-weight: 500;
        text-transform: uppercase;
        font-size: 0.75rem;
        color: #737373;
        border-bottom-width: 1px;
    }

    .calendar-container .fc-theme-standard .fc-scrollgrid {
        border: none;
    }

    .calendar-container .fc-theme-standard th {
        border-top: none;
        border-left: none;
        border-right: none;
    }

    .calendar-container.fc .fc-timegrid-now-indicator-arrow {
        border-width: 5px;
        border-radius: 5px;
        border-color: var(--fc-now-indicator-color);
        margin-top: -5px;
    }
    .calendar-container.fc .fc-timegrid-now-indicator-line {
        border-top-width: 2px;
    }

    .calendar-container .fc-event {
        border-radius: 6px;
        padding: 3px 6px;
        border: none;
        font-size: 0.75rem;
        font-weight: 500;
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        transition: transform 0.1s ease, box-shadow 0.1s ease;
    }

    .calendar-container .fc-event:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        z-index: 10 !important;
    }

    .calendar-container .local-event {
        background-color: var(--brand-color, #d35400);
        border-color: var(--brand-color, #d35400);
    }

    .calendar-container .fc-timegrid-event .fc-event-main {
        padding: 2px;
    }

    .calendar-container.fc .fc-button {
        border-radius: 8px;
        padding: 0.4rem 0.8rem;
        font-size: 0.875rem;
        font-weight: 500;
        text-transform: capitalize;
        transition: all 0.2s;
    }

    /* Styling for the custom action buttons */
    .calendar-container.fc .fc-createEvent-button,
    .calendar-container.fc .fc-createTask-button {
        background-color: var(--brand-color, #d35400);
        color: white;
        border: 1px solid var(--brand-color, #d35400);
        padding: 0.4rem 1rem;
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }
    
    .calendar-container.fc .fc-createEvent-button:hover,
    .calendar-container.fc .fc-createTask-button:hover {
        background-color: #e67e22;
        border-color: #e67e22;
        color: white;
    }

    /* Hamburger button styling */
    .calendar-container.fc .fc-toggleSidebar-button {
        font-size: 1.1rem;
        padding: 0.2rem 0.6rem;
        color: #525252;
        background: transparent;
        border: 1px solid rgba(0,0,0,0.1);
        margin-right: 0.5rem;
    }

    .calendar-container.fc .fc-button-primary:not(:disabled).fc-button-active, 
    .calendar-container.fc .fc-button-primary:not(:disabled):active {
        background-color: rgba(211, 84, 0, 0.1);
        border-color: rgba(211, 84, 0, 0.2);
        color: var(--brand-color, #d35400);
        box-shadow: none;
    }

    @media (prefers-color-scheme: dark) {
        .calendar-container.fc {
            --fc-border-color: rgba(255, 255, 255, 0.08);
            --fc-button-text-color: #a3a3a3;
            --fc-button-bg-color: #171717;
            --fc-button-border-color: rgba(255, 255, 255, 0.1);
            --fc-button-hover-bg-color: #262626;
            --fc-button-hover-border-color: rgba(255, 255, 255, 0.2);
            --fc-page-bg-color: transparent;
            --fc-neutral-bg-color: rgba(255, 255, 255, 0.02);
            --fc-today-bg-color: rgba(211, 84, 0, 0.1);
        }

        .calendar-container.fc .fc-toolbar-title {
            color: #fff;
        }

        .calendar-container.fc .fc-daygrid-day-number,
        .calendar-container.fc .fc-col-header-cell-cushion {
            color: #d4d4d4;
        }
    }

    .hide-scrollbar::-webkit-scrollbar {
        display: none;
    }
    .hide-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }

    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.1);
        border-radius: 10px;
    }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(255, 255, 255, 0.1);
    }
`}} />
        </div>
    );
}
