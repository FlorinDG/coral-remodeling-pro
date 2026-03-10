"use client";

import React, { useRef, useEffect, useState } from 'react';
import '@fortune-sheet/react/dist/index.css';

// Dynamically import FortuneSheet to avoid SSR issues
// We have to use a wrapper component because FortuneSheet requires window object
export default function ExcelClone() {
    const [isClient, setIsClient] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return <div className="flex h-full min-h-[600px] items-center justify-center text-neutral-500">Loading Spreadsheet...</div>;
    }

    // We need to require it conditionally inside the render when we are on the client
    const { Workbook } = require('@fortune-sheet/react');

    return (
        <div className="flex flex-col h-full min-h-[calc(100vh-8rem)] bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Excel Module</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Advanced spreadsheet capabilities for complex data management.</p>
            </div>
            <div className="flex-1 relative w-full h-full" ref={containerRef}>
                <Workbook
                    data={[
                        {
                            name: "Sheet1",
                            celldata: [
                                { r: 0, c: 0, v: { v: "Module", m: "Module", bg: "#f3f4f6", bl: 1 } },
                                { r: 0, c: 1, v: { v: "Status", m: "Status", bg: "#f3f4f6", bl: 1 } },
                                { r: 0, c: 2, v: { v: "Notes", m: "Notes", bg: "#f3f4f6", bl: 1 } },
                                { r: 1, c: 0, v: { v: "Time Tracker", m: "Time Tracker" } },
                                { r: 1, c: 1, v: { v: "Active", m: "Active" } },
                                { r: 2, c: 0, v: { v: "Spreadsheet", m: "Spreadsheet" } },
                                { r: 2, c: 1, v: { v: "In Progress", m: "In Progress" } },
                            ],
                            column: 20,
                            row: 50,
                            defaultColWidth: 120,
                        }
                    ]}
                    onChange={(data: any) => {
                        console.log("Sheet changed", data);
                    }}
                />
            </div>
        </div>
    );
}
