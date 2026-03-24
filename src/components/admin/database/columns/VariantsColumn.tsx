import React from 'react';
import { Column } from 'react-datasheet-grid';
import { VariantsConfig } from '../types';

export const variantsColumn: Partial<Column<any, any>> = {
    component: ({ rowData }) => {
        const config = rowData as VariantsConfig;
        const count = Array.isArray(config) ? config.length : 0;

        return (
            <div className="flex h-full w-full items-center justify-start px-3 bg-neutral-50/50 dark:bg-black/10 cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors">
                <span className="text-[11px] font-bold text-neutral-500 tracking-wider uppercase bg-neutral-200 dark:bg-white/10 px-2 py-0.5 rounded-md shadow-sm">
                    {count} Axes
                </span>
            </div>
        );
    },
    disableKeys: true,
    keepFocus: false,
    disabled: true,
};
