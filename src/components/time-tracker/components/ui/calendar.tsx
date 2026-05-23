"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/components/time-tracker/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        /* Layout wrappers */
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center h-10",
        caption_label: "text-sm font-semibold text-neutral-900 dark:text-white",

        /* Navigation */
        nav: "flex items-center gap-1",
        button_previous: cn(
          "absolute left-1 inline-flex items-center justify-center h-7 w-7 rounded-md border border-neutral-200 dark:border-white/10",
          "bg-transparent hover:bg-neutral-100 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
        ),
        button_next: cn(
          "absolute right-1 inline-flex items-center justify-center h-7 w-7 rounded-md border border-neutral-200 dark:border-white/10",
          "bg-transparent hover:bg-neutral-100 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
        ),

        /* Weekday headers */
        weekdays: "flex w-full",
        weekday: "text-neutral-500 dark:text-neutral-400 rounded-md w-9 font-medium text-[0.8rem] text-center",

        /* Week rows */
        week: "flex w-full mt-1",

        /* Day cells */
        day: "h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center",
        day_button: cn(
          "inline-flex items-center justify-center h-9 w-9 rounded-md text-sm font-normal transition-colors",
          "hover:bg-neutral-100 dark:hover:bg-white/10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color,#d35400)]/40",
          "aria-selected:opacity-100"
        ),

        /* State modifiers */
        selected: cn(
          "bg-[var(--brand-color,#d35400)] text-white rounded-md",
          "hover:bg-[var(--brand-color,#d35400)] hover:text-white",
          "focus:bg-[var(--brand-color,#d35400)] focus:text-white"
        ),
        today: "bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-white font-bold rounded-md ring-1 ring-neutral-300 dark:ring-white/20",
        outside: "text-neutral-400 dark:text-neutral-600 opacity-50 aria-selected:bg-neutral-100 aria-selected:text-neutral-500 aria-selected:opacity-30",
        disabled: "text-neutral-300 dark:text-neutral-600 opacity-50",
        range_middle: "aria-selected:bg-neutral-100 dark:aria-selected:bg-white/5 aria-selected:text-neutral-900 dark:aria-selected:text-white",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ ...chevronProps }) => {
          if (chevronProps.orientation === 'left') {
            return <ChevronLeft className="h-4 w-4" />;
          }
          return <ChevronRight className="h-4 w-4" />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
