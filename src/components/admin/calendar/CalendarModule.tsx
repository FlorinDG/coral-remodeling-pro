"use client";

import React, { useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import googleCalendarPlugin from '@fullcalendar/google-calendar';
import { Settings, Plus, Calendar as CalendarIcon, Check } from 'lucide-react';

export default function CalendarModule() {
    const calendarRef = useRef<FullCalendar>(null);
    const [showSettings, setShowSettings] = useState(false);

    // This state would ideally be loaded from a database or secure config in a real app
    const [googleApiKey, setGoogleApiKey] = useState(process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY || '');
    const [calendarId, setCalendarId] = useState(process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID || '');

    const [tempApiKey, setTempApiKey] = useState(googleApiKey);
    const [tempCalendarId, setTempCalendarId] = useState(calendarId);

    const handleSaveSettings = () => {
        setGoogleApiKey(tempApiKey);
        setCalendarId(tempCalendarId);
        setShowSettings(false);
    };

    return (
        <div className="flex h-full min-h-[calc(100vh-8rem)] bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">

            {/* Sidebar / Settings Area */}
            <div className={`w-80 border-r border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 flex flex-col transition-all duration-300 ${showSettings ? 'ml-0' : '-ml-80'}`}>
                <div className="p-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between">
                    <h2 className="font-semibold flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Integrations
                    </h2>
                    <button
                        onClick={() => setShowSettings(false)}
                        className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                        Close
                    </button>
                </div>

                <div className="p-4 space-y-6 flex-1 overflow-y-auto w-80">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-medium mb-1">Google Calendar</h3>
                            <p className="text-xs text-neutral-500 mb-4">Connect a public Google Calendar to display events.</p>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">API Key</label>
                                <input
                                    type="password"
                                    value={tempApiKey}
                                    onChange={(e) => setTempApiKey(e.target.value)}
                                    placeholder="AIzaSy..."
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#d35400]/50"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">Calendar ID</label>
                                <input
                                    type="text"
                                    value={tempCalendarId}
                                    onChange={(e) => setTempCalendarId(e.target.value)}
                                    placeholder="example@group.calendar.google.com"
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#d35400]/50"
                                />
                            </div>
                            <button
                                onClick={handleSaveSettings}
                                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-[#d35400] text-white rounded-lg text-sm font-medium hover:bg-[#e67e22] transition-colors"
                            >
                                <Check className="w-4 h-4" />
                                Apply Configuration
                            </button>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-neutral-200 dark:border-white/10">
                        <h3 className="text-sm font-medium mb-1 flex items-center gap-2 text-neutral-400">
                            <Plus className="w-4 h-4" /> Add Configuration
                        </h3>
                        <p className="text-xs text-neutral-500 mt-2">Outlook, Apple Calendar integrations coming soon.</p>
                    </div>
                </div>
            </div>

            {/* Main Calendar Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-neutral-950">
                <div className="p-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-[#d35400]" />
                            Schedule Master
                        </h2>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">View and manage your upcoming events and appointments.</p>
                    </div>
                    {!showSettings && (
                        <button
                            onClick={() => setShowSettings(true)}
                            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            Settings
                        </button>
                    )}
                </div>

                <div className="flex-1 p-6 overflow-hidden calendar-container">
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, googleCalendarPlugin]}
                        initialView="dayGridMonth"
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'dayGridMonth,timeGridWeek,timeGridDay'
                        }}
                        googleCalendarApiKey={googleApiKey || undefined}
                        events={calendarId ? { googleCalendarId: calendarId } : []}
                        height="100%"
                        editable={true}
                        selectable={true}
                        selectMirror={true}
                        dayMaxEvents={true}
                        eventClick={(info) => {
                            if (info.event.url) {
                                window.open(info.event.url, '_blank', 'noopener,noreferrer');
                                info.jsEvent.preventDefault(); // prevents browser from following url
                            }
                        }}
                    />
                </div>
            </div>

            {/* Custom Styles for FullCalendar to match the app theme */}
            <style dangerouslySetInnerHTML={{
                __html: `
        .calendar-container .fc {
          --fc-border-color: rgba(0,0,0,0.1);
          --fc-button-text-color: #171717;
          --fc-button-bg-color: #f5f5f5;
          --fc-button-border-color: rgba(0,0,0,0.1);
          --fc-button-hover-bg-color: #e5e5e5;
          --fc-button-hover-border-color: rgba(0,0,0,0.2);
          --fc-button-active-bg-color: #d35400;
          --fc-button-active-border-color: #d35400;
          --fc-button-active-text-color: #fff;
          --fc-today-bg-color: rgba(211, 84, 0, 0.05);
        }

        .calendar-container .fc .fc-toolbar-title {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .calendar-container .fc .fc-button-primary:not(:disabled).fc-button-active, 
        .calendar-container .fc .fc-button-primary:not(:disabled):active {
          background-color: #d35400;
          border-color: #d35400;
        }

        .calendar-container .fc-event {
          border-radius: 4px;
          padding: 2px 4px;
          border: none;
          background-color: #d35400;
          font-size: 0.75rem;
        }

        @media (prefers-color-scheme: dark) {
          .calendar-container .fc {
            --fc-border-color: rgba(255,255,255,0.1);
            --fc-button-text-color: #fff;
            --fc-button-bg-color: rgba(255,255,255,0.05);
            --fc-button-border-color: rgba(255,255,255,0.1);
            --fc-button-hover-bg-color: rgba(255,255,255,0.1);
            --fc-button-hover-border-color: rgba(255,255,255,0.2);
            --fc-page-bg-color: transparent;
            --fc-neutral-bg-color: rgba(255,255,255,0.02);
            --fc-today-bg-color: rgba(211, 84, 0, 0.15);
          }
          
          .calendar-container .fc .fc-daygrid-day-number,
          .calendar-container .fc .fc-col-header-cell-cushion {
            color: #d4d4d4;
          }
        }
      `}} />
        </div>
    );
}
