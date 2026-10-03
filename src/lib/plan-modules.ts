/** Plan → modules — the canonical mapping (moved verbatim from stripe.ts so pure code and tests can read it). */
export const PLAN_MODULES: Record<string, string[]> = {
    FREE:       ['INVOICING'],
    PRO:        ['INVOICING', 'CRM', 'PROJECTS', 'CALENDAR', 'DATABASES', 'TASKS'],
    ENTERPRISE: ['INVOICING', 'CRM', 'PROJECTS', 'CALENDAR', 'DATABASES', 'TASKS', 'HR', 'WEBSITES', 'EMAIL'],
    FOUNDER:    ['INVOICING', 'CRM', 'PROJECTS', 'CALENDAR', 'DATABASES', 'TASKS', 'HR', 'WEBSITES', 'EMAIL'],
    CUSTOM:     ['INVOICING', 'CRM', 'PROJECTS', 'CALENDAR', 'DATABASES', 'TASKS', 'HR', 'WEBSITES', 'EMAIL'],
};
