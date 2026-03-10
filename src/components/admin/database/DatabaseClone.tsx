"use client";

import React, { useState } from 'react';
import {
    DataSheetGrid,
    checkboxColumn,
    textColumn,
    keyColumn,
    intColumn,
} from 'react-datasheet-grid';
import 'react-datasheet-grid/dist/style.css';

// Using a standard data structure to mimic a database 
type Row = {
    active: boolean;
    name: string;
    category: string;
    priority: number | null;
    notes: string | null;
};

export default function DatabaseClone() {
    const [data, setData] = useState<Row[]>([
        { active: true, name: 'Finish Kitchen Redesign', category: 'Project', priority: 1, notes: 'Awaiting client approval on tiles' },
        { active: false, name: 'Call Suppliers', category: 'Task', priority: 2, notes: 'Need updated quotes for Q3' },
        { active: true, name: 'Draft Monthly Report', category: 'Admin', priority: 3, notes: null },
        { active: true, name: 'Site Visit: 124 Main St', category: 'Project', priority: 1, notes: 'Check plumbing status' },
    ]);

    const columns = [
        { ...keyColumn('active', checkboxColumn), title: 'Active', minWidth: 60 },
        { ...keyColumn('name', textColumn), title: 'Name' },
        { ...keyColumn('category', textColumn), title: 'Category' },
        { ...keyColumn('priority', intColumn), title: 'Priority', minWidth: 80 },
        { ...keyColumn('notes', textColumn), title: 'Notes' },
    ];

    return (
        <div className="flex flex-col h-full min-h-[calc(100vh-8rem)] bg-white dark:bg-black w-full border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Database Module</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Manage structure data with rich cell types and Airtable-like grid functionality.</p>
            </div>

            <div className="flex-1 w-full bg-white dark:bg-neutral-950 p-4">
                <DataSheetGrid
                    value={data}
                    // Cast data back to Row[] because react-datasheet-grid's onChange provides Record<string, any>[]
                    onChange={(newValue) => setData(newValue as Row[])}
                    columns={columns}
                    autoAddRow
                    lockRows={false}
                    className="h-full database-grid-custom"
                />
            </div>

            {/* Adding custom styling for the grid to sit cleanly in dark node */}
            <style dangerouslySetInnerHTML={{
                __html: `
        .database-grid-custom {
          --dsg-border-color: rgba(0, 0, 0, 0.1);
        }
        
        @media (prefers-color-scheme: dark) {
          .database-grid-custom {
            --dsg-border-color: rgba(255, 255, 255, 0.1);
            --dsg-header-background-color: rgba(255,255,255, 0.05);
            --dsg-cell-background-color: transparent;
            --dsg-header-text-color: #fff;
            --dsg-cell-text-color: #fff;
            background: transparent;
          }
        }
      `}} />
        </div>
    );
}
