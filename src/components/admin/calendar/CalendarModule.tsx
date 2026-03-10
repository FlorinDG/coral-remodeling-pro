"use client";

import React, { useRef, useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import googleCalendarPlugin from '@fullcalendar/google-calendar';
import { Settings, Plus, Calendar as CalendarIcon, Check, X, Clock, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { nanoid } from 'nanoid';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

interface CustomEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    backgroundColor?: string;
    borderColor?: string;
}

export default function CalendarModule() {
    const calendarRef = useRef<FullCalendar>(null);
    const [date, setDate] = useState<Date>(new Date());
    const [showSettings, setShowSettings] = useState(false);

    // Google Calendar State
    const [googleApiKey, setGoogleApiKey] = useState(process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY || '');
    const [calendarId, setCalendarId] = useState(process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID || '');
    const [tempApiKey, setTempApiKey] = useState(googleApiKey);
    const [tempCalendarId, setTempCalendarId] = useState(calendarId);

    // Custom Events State
    const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [newEvent, setNewEvent] = useState({ title: '', start: '', end: '', allDay: false });

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
            title: '',
            start: selectInfo.startStr,
            end: selectInfo.endStr,
            allDay: selectInfo.allDay
        });
        setIsEventModalOpen(true);
        selectInfo.view.calendar.unselect();
    };

    const handleSaveEvent = () => {
        if (!newEvent.title.trim()) return;

        const event: CustomEvent = {
            id: nanoid(),
            title: newEvent.title,
            start: newEvent.start,
            end: newEvent.end,
            allDay: newEvent.allDay,
            backgroundColor: '#d35400',
            borderColor: '#d35400',
        };

        setCustomEvents([...customEvents, event]);
        setIsEventModalOpen(false);
    };

    return (
        <div className="flex h-full min-h-[calc(100vh-8rem)] bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm relative">

            {/* Sidebar / Settings Area */}
            <div className={`w-80 border-r border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-neutral-900/20 flex flex-col transition-all duration-300`}>
                <div className="p-5 border-b border-neutral-200 dark:border-white/10">
                    <button
                        onClick={() => {
                            const now = new Date();
                            setNewEvent({ title: '', start: now.toISOString(), end: new Date(now.getTime() + 60 * 60 * 1000).toISOString(), allDay: false });
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
                                --rdp-cell-size: 34px;
                                --rdp-accent-color: #d35400;
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
                        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5" /> My Calendars
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-100/50 dark:bg-white/5">
                            <div className="w-3 h-3 rounded-full bg-[#d35400]"></div>
                            <span className="text-sm font-medium">Local Events</span>
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-100/50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span className="text-sm font-medium">Google Calendar</span>
                        </div>
                    </div>

                    {/* Google Config Accordion */}
                    <div className="border-t border-neutral-200 dark:border-white/10 pt-4 mt-auto">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="w-full flex items-center justify-between px-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-[#d35400] dark:hover:text-[#d35400] transition-colors"
                        >
                            <span className="flex items-center gap-2"><Settings className="w-4 h-4" /> Integrations</span>
                            {showSettings ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>

                        {showSettings && (
                            <div className="mt-4 space-y-3 px-2 pb-2 animate-in slide-in-from-top-2 opacity-0 fade-in duration-200 fill-mode-forwards">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1 block">Google API Key</label>
                                    <input
                                        type="password"
                                        value={tempApiKey}
                                        onChange={(e) => setTempApiKey(e.target.value)}
                                        placeholder="AIzaSy..."
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-[#d35400]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1 block">Calendar ID</label>
                                    <input
                                        type="text"
                                        value={tempCalendarId}
                                        onChange={(e) => setTempCalendarId(e.target.value)}
                                        placeholder="example@group.calendar.google.com"
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-[#d35400]"
                                    />
                                </div>
                                <button
                                    onClick={() => { setGoogleApiKey(tempApiKey); setCalendarId(tempCalendarId); setShowSettings(false); }}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                                >
                                    <Check className="w-3.5 h-3.5" /> Save
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Calendar Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-black rounded-r-2xl border-l border-neutral-200 dark:border-white/10">
                <div className="flex-1 p-6 overflow-hidden calendar-container">
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, googleCalendarPlugin]}
                        initialView="timeGridWeek"
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'dayGridMonth,timeGridWeek,timeGridDay'
                        }}
                        googleCalendarApiKey={googleApiKey || undefined}
                        eventSources={[
                            ...(calendarId ? [{ googleCalendarId: calendarId, className: 'google-event' }] : []),
                            { events: customEvents, className: 'local-event' }
                        ]}
                        height="100%"
                        editable={true}
                        selectable={true}
                        selectMirror={true}
                        dayMaxEvents={true}
                        nowIndicator={true}
                        select={handleDateSelect}
                        eventClick={(info) => {
                            if (info.event.url) {
                                window.open(info.event.url, '_blank', 'noopener,noreferrer');
                                info.jsEvent.preventDefault();
                            }
                        }}
                        // Update local mini calendar when header buttons are clicked to change month
                        datesSet={(arg) => {
                            setDate(arg.view.currentStart);
                        }}
                    />
                </div>
            </div>

            {/* Custom Event Creation Modal */}
            {isEventModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-800/50">
                            <h3 className="font-semibold text-lg">New Event</h3>
                            <button onClick={() => setIsEventModalOpen(false)} className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                                <X className="w-5 h-5 text-neutral-500" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <input
                                    type="text"
                                    placeholder="Event title"
                                    className="w-full text-xl font-medium px-0 py-2 bg-transparent border-b-2 border-transparent focus:border-[#d35400] focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600 transition-colors"
                                    value={newEvent.title}
                                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                                <Clock className="w-4 h-4" />
                                <div className="flex gap-2 items-center">
                                    <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                                        {new Date(newEvent.start).toLocaleString([], { month: 'short', day: 'numeric', hour: newEvent.allDay ? undefined : '2-digit', minute: newEvent.allDay ? undefined : '2-digit' })}
                                    </span>
                                    <span>to</span>
                                    <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                                        {newEvent.end ? new Date(newEvent.end).toLocaleString([], { month: 'short', day: 'numeric', hour: newEvent.allDay ? undefined : '2-digit', minute: newEvent.allDay ? undefined : '2-digit' }) : '...'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="px-5 py-4 border-t border-neutral-100 dark:border-white/5 flex justify-end gap-2 bg-neutral-50/50 dark:bg-neutral-800/50">
                            <button
                                onClick={() => setIsEventModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEvent}
                                className="px-5 py-2 text-sm font-medium bg-[#d35400] hover:bg-[#e67e22] text-white rounded-lg transition-colors shadow-sm"
                            >
                                Save Event
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Apple/Google Calendar CSS Overrides */}
            <style dangerouslySetInnerHTML={{
                __html: `
        .calendar-container .fc {
          --fc-border-color: rgba(0,0,0,0.06);
          --fc-button-text-color: #525252;
          --fc-button-bg-color: #fff;
          --fc-button-border-color: rgba(0,0,0,0.1);
          --fc-button-hover-bg-color: #f5f5f5;
          --fc-button-hover-border-color: rgba(0,0,0,0.2);
          --fc-button-active-bg-color: #fef3c7;
          --fc-button-active-border-color: #d35400;
          --fc-button-active-text-color: #d35400;
          --fc-today-bg-color: rgba(211, 84, 0, 0.03);
          --fc-now-indicator-color: #ef4444;
          font-family: inherit;
        }

        .calendar-container .fc .fc-toolbar-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #171717;
        }

        .calendar-container .fc .fc-col-header-cell {
          padding: 8px 0;
          font-weight: 500;
          text-transform: uppercase;
          font-size: 0.75rem;
          color: #737373;
          border-bottomWidth: 1px;
        }

        .calendar-container .fc-theme-standard .fc-scrollgrid {
          border: none;
        }

        .calendar-container .fc-theme-standard th {
          border-top: none;
          border-left: none;
          border-right: none;
        }

        /* Red Dot for Now Indicator */
        .calendar-container .fc .fc-timegrid-now-indicator-arrow {
            border-width: 5px;
            border-radius: 5px;
            border-color: var(--fc-now-indicator-color);
            margin-top: -5px;
        }
        .calendar-container .fc .fc-timegrid-now-indicator-line {
            border-top-width: 2px;
        }

        /* Beautiful Event Pills */
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

        .calendar-container .google-event {
            background-color: #3b82f6; /* Blue for google events */
        }
        
        .calendar-container .local-event {
            background-color: #d35400; /* Brand orange for local events */
        }

        .calendar-container .fc-timegrid-event .fc-event-main {
            padding: 2px;
        }

        /* Buttons styling */
        .calendar-container .fc .fc-button {
            border-radius: 8px;
            padding: 0.4rem 0.8rem;
            font-size: 0.875rem;
            font-weight: 500;
            text-transform: capitalize;
            transition: all 0.2s;
        }
        .calendar-container .fc .fc-button-primary:not(:disabled).fc-button-active, 
        .calendar-container .fc .fc-button-primary:not(:disabled):active {
          background-color: rgba(211, 84, 0, 0.1);
          border-color: rgba(211, 84, 0, 0.2);
          color: #d35400;
          box-shadow: none;
        }

        @media (prefers-color-scheme: dark) {
          .calendar-container .fc {
            --fc-border-color: rgba(255,255,255,0.08);
            --fc-button-text-color: #a3a3a3;
            --fc-button-bg-color: #171717;
            --fc-button-border-color: rgba(255,255,255,0.1);
            --fc-button-hover-bg-color: #262626;
            --fc-button-hover-border-color: rgba(255,255,255,0.2);
            --fc-page-bg-color: transparent;
            --fc-neutral-bg-color: rgba(255,255,255,0.02);
            --fc-today-bg-color: rgba(211, 84, 0, 0.1);
          }
          
          .calendar-container .fc .fc-toolbar-title {
              color: #fff;
          }

          .calendar-container .fc .fc-daygrid-day-number,
          .calendar-container .fc .fc-col-header-cell-cushion {
            color: #d4d4d4;
          }
        }
        
        /* Hide scrollbars for cleaner look */
        .hide-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}} />
        </div>
    );
}
