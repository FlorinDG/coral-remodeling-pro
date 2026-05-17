import { useCallback } from 'react';
import { Page } from '@/components/admin/database/types';
import { parseRecurrenceRule, getNextDueDate } from '../RecurrenceEngine';

interface UseRecurrenceOptions {
    /** Create a new page derived from the completed recurring task */
    createPage: (props: Record<string, unknown>) => Promise<void>;
}

/**
 * Returns a handler to call when a task is marked done.
 * If the task has a recurrence rule, it creates the next occurrence automatically.
 */
export function useRecurrence({ createPage }: UseRecurrenceOptions) {
    const handleTaskComplete = useCallback(async (page: Page) => {
        const ruleStr = page.properties['prop-task-recurrence'] as string | undefined;
        if (!ruleStr?.trim()) return;

        const rule = parseRecurrenceRule(ruleStr);
        if (!rule) return;

        const now = new Date();
        const nextDue = getNextDueDate(rule, now);
        const nextDueStr = nextDue.toISOString().slice(0, 10);

        // Clone the task's properties, reset completion fields
        const nextProps: Record<string, unknown> = {
            ...page.properties,
            'prop-task-status':       'opt-todo',
            'prop-task-completed-at': '',
            'prop-task-my-day':       false,
            'prop-task-due':          nextDueStr,
        };

        await createPage(nextProps);
    }, [createPage]);

    return { handleTaskComplete };
}
