import { useMemo } from 'react';
import { Page, FilterRule } from '@/components/admin/database/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SmartListId =
    | 'my-day' | 'today' | 'planned' | 'flagged'
    | 'assigned-to-me' | 'all' | 'completed' | 'no-date'
    | 'inbox' | 'projects' | 'hr-staff';

export interface ActivePerspective {
    type: 'smart-list' | 'tag' | 'custom';
    id: string;
    name: string;
    filters?: FilterRule[];
    tagId?: string;
}

export interface TaskGroup {
    sectionId: string;
    sectionName: string;
    color?: string;
    tasks: Page[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const isDone = (p: Page) => {
    const s = p.properties['prop-task-status'] as string | undefined;
    return s === 'opt-done' || s === 'opt-dropped';
};

const isToday = (v: unknown) =>
    typeof v === 'string' && v.slice(0, 10) === todayStr();

const hasFutureDate = (v: unknown) =>
    typeof v === 'string' && v.length >= 10 && v.slice(0, 10) > todayStr();

const isDeferred = (page: Page) => {
    const defer = page.properties['prop-task-defer'] as string | undefined;
    return !!defer && defer.length >= 10 && defer.slice(0, 10) > todayStr();
};

const PRIORITY_RANK: Record<string, number> = {
    'opt-p1': 0, 'opt-p2': 1, 'opt-p3': 2, 'opt-p4': 3,
};

const priorityOf = (p: Page) =>
    PRIORITY_RANK[p.properties['prop-task-priority'] as string] ?? 4;

// ── Smart list predicate map ──────────────────────────────────────────────────

function makeSmartFilter(id: string, userId: string): (page: Page) => boolean {
    switch (id as SmartListId) {
        case 'my-day':
            return p => p.properties['prop-task-my-day'] === true;
        case 'today':
            return p => !isDone(p) && isToday(p.properties['prop-task-due']);
        case 'planned':
            return p => !isDone(p) && !!p.properties['prop-task-due'];
        case 'flagged':
            return p => p.properties['prop-task-flagged'] === true;
        case 'assigned-to-me':
            return p => {
                const a = p.properties['prop-task-assignee'];
                return Array.isArray(a) && a.includes(userId);
            };
        case 'inbox':
            return p => {
                if (isDone(p)) return false;
                const project = p.properties['prop-task-project'];
                const assignee = p.properties['prop-task-assignee'];
                const due = p.properties['prop-task-due'];
                const hasProject = Array.isArray(project) && project.length > 0;
                const hasAssignee = Array.isArray(assignee) && assignee.length > 0;
                const hasDue = !!due;
                return !hasProject && !hasAssignee && !hasDue;
            };
        case 'projects':
            return p => {
                if (isDone(p)) return false;
                const project = p.properties['prop-task-project'];
                return Array.isArray(project) && project.length > 0;
            };
        case 'hr-staff':
            return p => {
                if (isDone(p)) return false;
                const assignee = p.properties['prop-task-assignee'];
                return Array.isArray(assignee) && assignee.length > 0;
            };
        case 'completed':
            return p => isDone(p);
        case 'no-date':
            return p => !isDone(p) && !p.properties['prop-task-due'];
        case 'all':
        default:
            return p => !isDone(p);
    }
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useTaskFilter({
    pages,
    perspective,
    userId,
    groupBySection = true,
}: {
    pages: Page[];
    perspective: ActivePerspective;
    userId: string;
    groupBySection?: boolean;
}): { groups: TaskGroup[]; flat: Page[]; total: number } {
    return useMemo(() => {
        // 1. Defer gate — always applied except in 'all'/'completed' views
        const showDeferred = perspective.id === 'all' || perspective.id === 'completed';
        let filtered = showDeferred
            ? pages
            : pages.filter(p => !isDeferred(p));

        // 2. Smart list / tag / custom filter
        if (perspective.type === 'smart-list') {
            const pred = makeSmartFilter(perspective.id, userId);
            filtered = filtered.filter(pred);
        } else if (perspective.type === 'tag' && perspective.tagId) {
            const tag = perspective.tagId;
            filtered = filtered.filter(p => {
                const tags = p.properties['prop-task-tags'] as string[] | undefined;
                return Array.isArray(tags) && tags.includes(tag);
            }).filter(p => !isDone(p));
        } else if (perspective.type === 'custom' && perspective.filters?.length) {
            const activeFilters = perspective.filters;
            const configuredFilters = activeFilters.filter(filter => {
                const isTextOp = ['equals', 'does_not_equal', 'contains'].includes(filter.operator);
                if (isTextOp && (filter.value === '' || filter.value === undefined || filter.value === null)) {
                    return false;
                }
                return true;
            });

            if (configuredFilters.length > 0) {
                filtered = filtered.filter(page => {
                    const evaluateRule = (filter: typeof activeFilters[0]) => {
                        const val = page.properties[filter.propertyId];
                        switch (filter.operator) {
                            case 'equals':          return String(val) === String(filter.value);
                            case 'does_not_equal':  return String(val) !== String(filter.value);
                            case 'contains':        return String(val).toLowerCase().includes(String(filter.value).toLowerCase());
                            case 'is_empty':        return !val || val === '' || (Array.isArray(val) && val.length === 0);
                            case 'is_not_empty':    return !!val && val !== '' && !(Array.isArray(val) && val.length === 0);
                            default: return true;
                        }
                    };

                    let result = evaluateRule(configuredFilters[0]);

                    for (let i = 1; i < configuredFilters.length; i++) {
                        const rule = configuredFilters[i];
                        const ruleResult = evaluateRule(rule);
                        if (rule.conjunction === 'or') {
                            result = result || ruleResult;
                        } else {
                            result = result && ruleResult;
                        }
                    }

                    return result;
                });
            }
        }

        // 3. Sort: priority → due date → order
        filtered.sort((a, b) => {
            const pd = priorityOf(a) - priorityOf(b);
            if (pd !== 0) return pd;
            const da = (a.properties['prop-task-due'] as string) || '';
            const db2 = (b.properties['prop-task-due'] as string) || '';
            if (da && db2) return da.localeCompare(db2);
            if (da) return -1;
            if (db2) return 1;
            return (a.order ?? 0) - (b.order ?? 0);
        });

        // 4. Group by section (optional)
        if (!groupBySection) {
            return { groups: [{ sectionId: '__all', sectionName: '', tasks: filtered }], flat: filtered, total: filtered.length };
        }

        const sectionMap = new Map<string, { name: string; color?: string; tasks: Page[] }>();
        const SECTION_NAMES: Record<string, { name: string; color: string }> = {
            'sec-planning':  { name: 'Planning',  color: 'blue'   },
            'sec-execution': { name: 'Execution', color: 'orange' },
            'sec-review':    { name: 'In Review', color: 'purple' },
            'sec-admin':     { name: 'Admin',     color: 'gray'   },
            '':              { name: 'No Section', color: 'gray'  },
        };

        filtered.forEach(p => {
            const sec = (p.properties['prop-task-section'] as string) || '';
            if (!sectionMap.has(sec)) {
                const meta = SECTION_NAMES[sec] || { name: sec, color: 'gray' };
                sectionMap.set(sec, { name: meta.name, color: meta.color, tasks: [] });
            }
            sectionMap.get(sec)!.tasks.push(p);
        });

        const groups: TaskGroup[] = [];
        // Order: defined sections first, then unsectioned
        const ORDER = ['sec-planning', 'sec-execution', 'sec-review', 'sec-admin', ''];
        ORDER.forEach(key => {
            if (sectionMap.has(key)) {
                const s = sectionMap.get(key)!;
                groups.push({ sectionId: key, sectionName: s.name, color: s.color, tasks: s.tasks });
                sectionMap.delete(key);
            }
        });
        sectionMap.forEach((s, key) => {
            groups.push({ sectionId: key, sectionName: s.name, color: s.color, tasks: s.tasks });
        });

        return { groups: groups.filter(g => g.tasks.length > 0), flat: filtered, total: filtered.length };
    }, [pages, perspective, userId, groupBySection]);
}

export { hasFutureDate };
