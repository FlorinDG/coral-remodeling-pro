import path from 'node:path';
import stream from 'node:stream';
import zlib from 'node:zlib';
import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';
// @ts-expect-error -- @react-pdf/pdfkit lacks bundled type definitions
import PDFDocument from '@react-pdf/pdfkit';
import { formatDecimalHours, formatHoursMinutes } from '@/lib/computeWorkedDuration';
import { zonedParts } from '@/lib/kernel/shift-time';

const h = React.createElement;

// Register static IBM Plex Sans fonts (IBM Plex 3.005, SIL OFL, full Latin-ext + Cyrillic coverage)
Font.register({
    family: 'IBM Plex Sans',
    fonts: [
        { src: path.join(process.cwd(), 'src/lib/documents/fonts/IBMPlexSans-Regular.ttf'), fontWeight: 400 },
        { src: path.join(process.cwd(), 'src/lib/documents/fonts/IBMPlexSans-Bold.ttf'), fontWeight: 700 },
    ],
});

// Stabilize PDFKit reference stream compression:
// PDFKit's default async zlib.createDeflate dispatches compression tasks across libuv threadpool workers,
// which finish in non-deterministic order and cause race conditions in stream object ordering.
// Patching PDFReference.initDeflate with synchronous inline deflation guarantees 100% byte determinism (C1).
try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sampleDoc = new (PDFDocument as any)();
    const PDFReference = sampleDoc.ref().constructor;
    if (PDFReference && PDFReference.prototype && !PDFReference.prototype.__deterministicDeflate) {
        PDFReference.prototype.__deterministicDeflate = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        PDFReference.prototype.initDeflate = function (this: any) {
            this.data.Filter = 'FlateDecode';
            const chunks: Buffer[] = [];
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const that = this;
            const syncDeflate = new stream.Writable({
                write(chunk: Buffer | Uint8Array | string, _enc: string, cb: () => void) {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                    cb();
                },
                final(cb: () => void) {
                    const raw = Buffer.concat(chunks);
                    const compressed = zlib.deflateSync(raw);
                    that.chunks.push(compressed);
                    that.data.Length += compressed.length;
                    that.finalize();
                    cb();
                },
            });
            this.deflate = syncDeflate;
        };
    }
} catch {
    // Defensive fallback if environment restricts internal PDFKit patching
}

export class SignedWorkOrderValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SignedWorkOrderValidationError';
    }
}

export interface SignedWorkOrderPdfInput {
    tenant: {
        name: string;
        vatNumber?: string | null;
        address?: string | null;
        logoPng?: Buffer | null;
        logoUrl?: string | null;
        brandColor?: string | null;
    };
    client: {
        name: string;
        address?: string | null;
    } | null;
    workOrder: {
        reference: string;
        date: string; /* YYYY-MM-DD, Brussels */
        siteAddress?: string | null;
        projectName?: string | null;
    };
    lines: Array<{
        workerName: string;
        in: string; /* HH:mm */
        out: string; /* HH:mm */
        minutes: number;
    }>;
    tasks: Array<{
        title: string;
        done: boolean;
    }>;
    /** Printed: shift description (scheduler 'Notes') — client-visible. */
    description: string | null;
    /** Printed: crew notes — client-visible. */
    crewNotes: Array<{
        workerName: string;
        note: string;
    }>;
    signature: {
        signerName: string;
        signedAt: string; /* ISO instant */
        imagePng: Buffer;
    };
    language: 'nl' | 'fr' | 'en';
}

export const WORK_ORDER_LABELS = {
    nl: {
        title: 'WERKBON',
        reference: 'Werkbon nr.',
        date: 'Datum',
        project: 'Project',
        siteAddress: 'Werfadres',
        client: 'Klant',
        performances: 'Prestaties',
        worker: 'Medewerker',
        from: 'Van',
        to: 'Tot',
        duration: 'Duur',
        total: 'TOTAAL',
        tasks: 'Uitgevoerde taken',
        description: 'Omschrijving',
        crewNotes: 'Opmerkingen uitvoering',
        signature: 'Ondertekening voor akkoord',
        signedBy: 'Ondertekend door',
        signedAt: 'Tijdstip',
        declaration: 'Voor akkoord met de gepresteerde uren en uitgevoerde werken.',
        unit: 'u',
        page: 'Pagina',
        of: 'van',
    },
    fr: {
        title: 'BON DE TRAVAIL',
        reference: 'N° de bon',
        date: 'Date',
        project: 'Projet',
        siteAddress: 'Adresse du chantier',
        client: 'Client',
        performances: 'Prestations',
        worker: 'Collaborateur',
        from: 'De',
        to: 'À',
        duration: 'Durée',
        total: 'TOTAL',
        tasks: 'Tâches exécutées',
        description: 'Description',
        crewNotes: 'Remarques exécution',
        signature: 'Signature pour accord',
        signedBy: 'Signé par',
        signedAt: 'Date et heure',
        declaration: 'Pour accord avec les heures prestées et les travaux exécutés.',
        unit: 'h',
        page: 'Page',
        of: 'sur',
    },
    en: {
        title: 'WORK ORDER',
        reference: 'Work order ref.',
        date: 'Date',
        project: 'Project',
        siteAddress: 'Site address',
        client: 'Client',
        performances: 'Work performed',
        worker: 'Worker',
        from: 'From',
        to: 'To',
        duration: 'Duration',
        total: 'TOTAL',
        tasks: 'Completed tasks',
        description: 'Description',
        crewNotes: 'Crew notes',
        signature: 'Signed for approval',
        signedBy: 'Signed by',
        signedAt: 'Timestamp',
        declaration: 'Approved for the hours worked and the tasks executed.',
        unit: 'h',
        page: 'Page',
        of: 'of',
    },
} as const;

export type WorkOrderLabels = typeof WORK_ORDER_LABELS[keyof typeof WORK_ORDER_LABELS];

export interface WorkOrderView {
    language: 'nl' | 'fr' | 'en';
    tenant: {
        name: string;
        vatNumber: string | null;
        address: string | null;
        brandColor: string;
        logoPng: Buffer | null;
    };
    client: {
        name: string;
        address: string | null;
    } | null;
    workOrder: {
        reference: string;
        date: string;
        siteAddress: string | null;
        projectName: string | null;
    };
    lines: Array<{
        workerName: string;
        in: string;
        out: string;
        minutes: number;
        formattedDuration: string;
    }>;
    totals: {
        totalMinutes: number;
        formattedDuration: string;
    };
    tasks: Array<{
        title: string;
        done: boolean;
    }>;
    description: string | null;
    crewNotes: Array<{
        workerName: string;
        note: string;
    }>;
    signature: {
        signerName: string;
        signedAtFormatted: string;
        signedAtInstant: string;
        imagePng: Buffer;
        declaration: string;
    };
    labels: WorkOrderLabels;
}

export function validateSignedWorkOrderInput(input: SignedWorkOrderPdfInput): void {
    if (!input) {
        throw new SignedWorkOrderValidationError('Input is required');
    }
    if (!input.signature?.signerName || !input.signature.signerName.trim()) {
        throw new SignedWorkOrderValidationError('Signer name is required');
    }
    if (!input.signature?.imagePng || input.signature.imagePng.length === 0) {
        throw new SignedWorkOrderValidationError('Signature image is required');
    }
    if (!input.lines || input.lines.length === 0) {
        throw new SignedWorkOrderValidationError('At least one work order line is required');
    }
}

/**
 * Pure function: converts input into the complete set of strings and values rendered on the document.
 * Enforces validation, Brussels timezone formatting (C2), and locale-specific hours format.
 */
export function buildWorkOrderView(input: SignedWorkOrderPdfInput): WorkOrderView {
    validateSignedWorkOrderInput(input);

    const lang = input.language && WORK_ORDER_LABELS[input.language] ? input.language : 'nl';
    const labels = WORK_ORDER_LABELS[lang];
    const locale = lang === 'en' ? 'en-GB' : 'nl-BE';

    // Brussels wall-clock formatting for the signature instant (C2)
    const signedParts = zonedParts(input.signature.signedAt);
    const [sy, sm, sd] = signedParts.date.split('-');
    const signedAtFormatted = `${sd}/${sm}/${sy} ${signedParts.time}`;

    // Format work order date: input is YYYY-MM-DD
    let workOrderDateFormatted = input.workOrder.date;
    if (input.workOrder.date && input.workOrder.date.includes('-')) {
        const [wy, wm, wd] = input.workOrder.date.split('-');
        if (wy && wm && wd) {
            workOrderDateFormatted = `${wd}/${wm}/${wy}`;
        }
    }

    // Format each line: "7,50 u (07:30)"
    const lines = input.lines.map(line => {
        const dec = formatDecimalHours(line.minutes, locale);
        const hm = formatHoursMinutes(line.minutes);
        return {
            workerName: line.workerName,
            in: line.in,
            out: line.out,
            minutes: line.minutes,
            formattedDuration: `${dec} ${labels.unit} (${hm})`,
        };
    });

    // Total from SUMMED MINUTES (C1 / computeWorkedDuration rule)
    const totalMinutes = input.lines.reduce((acc, line) => acc + (line.minutes || 0), 0);
    const totalDec = formatDecimalHours(totalMinutes, locale);
    const totalHm = formatHoursMinutes(totalMinutes);
    const totalFormatted = `${totalDec} ${labels.unit} (${totalHm})`;

    return {
        language: lang,
        tenant: {
            name: input.tenant.name,
            vatNumber: input.tenant.vatNumber || null,
            address: input.tenant.address || null,
            brandColor: input.tenant.brandColor || '#ea580c',
            logoPng: input.tenant.logoPng || null,
        },
        client: input.client
            ? {
                name: input.client.name,
                address: input.client.address || null,
            }
            : null,
        workOrder: {
            reference: input.workOrder.reference,
            date: workOrderDateFormatted,
            siteAddress: input.workOrder.siteAddress || null,
            projectName: input.workOrder.projectName || null,
        },
        lines,
        totals: {
            totalMinutes,
            formattedDuration: totalFormatted,
        },
        tasks: (input.tasks || []).map(t => ({ title: t.title, done: !!t.done })),
        description: input.description && input.description.trim() ? input.description.trim() : null,
        crewNotes: (input.crewNotes || []).filter(n => n.note && n.note.trim()).map(n => ({
            workerName: n.workerName,
            note: n.note.trim(),
        })),
        signature: {
            signerName: input.signature.signerName.trim(),
            signedAtFormatted,
            signedAtInstant: input.signature.signedAt,
            imagePng: input.signature.imagePng,
            declaration: labels.declaration,
        },
        labels,
    };
}

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica',
        fontSize: 9,
        color: '#1f2937',
        backgroundColor: '#FFFFFF',
        paddingTop: 36,
        paddingBottom: 45,
        paddingHorizontal: 40,
        lineHeight: 1.4,
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 18,
    },
    tenantBlock: {
        maxWidth: '55%',
    },
    tenantName: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 700,
        fontSize: 13,
        color: '#111827',
        marginBottom: 3,
    },
    tenantText: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 400,
        fontSize: 8.5,
        color: '#4b5563',
    },
    logo: {
        maxHeight: 40,
        maxWidth: 120,
        objectFit: 'contain',
        marginBottom: 6,
    },
    docBlock: {
        alignItems: 'flex-end',
        maxWidth: '42%',
    },
    docTitle: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 700,
        fontSize: 16,
        color: '#111827',
        marginBottom: 4,
    },
    metaText: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 400,
        fontSize: 8.5,
        color: '#374151',
    },
    metaTextBold: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 700,
    },
    infoGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#f9fafb',
        borderRadius: 4,
        padding: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    infoCol: {
        width: '48%',
    },
    infoLabel: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 700,
        fontSize: 8,
        color: '#6b7280',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    infoValueBold: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 700,
        fontSize: 9.5,
        color: '#111827',
        marginBottom: 2,
    },
    infoValue: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 400,
        fontSize: 8.5,
        color: '#374151',
    },
    sectionTitle: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 700,
        fontSize: 10,
        color: '#111827',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingBottom: 4,
        marginBottom: 8,
    },
    table: {
        marginBottom: 16,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#d1d5db',
        paddingBottom: 4,
        marginBottom: 4,
    },
    tableHeaderCell: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 700,
        fontSize: 8,
        color: '#4b5563',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 3.5,
        borderBottomWidth: 0.5,
        borderBottomColor: '#f3f4f6',
    },
    tableTotalRow: {
        flexDirection: 'row',
        paddingTop: 6,
        marginTop: 2,
        borderTopWidth: 1.5,
        borderTopColor: '#111827',
    },
    colWorker: { width: '45%' },
    colTime: { width: '17%', textAlign: 'center' },
    colDuration: { width: '21%', textAlign: 'right' },
    tableCell: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 400,
        fontSize: 8.5,
        color: '#1f2937',
    },
    tableCellBold: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 700,
        fontSize: 9,
        color: '#111827',
    },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 2,
    },
    taskBox: {
        width: 12,
        height: 12,
        borderWidth: 1,
        borderColor: '#9ca3af',
        borderRadius: 2,
        marginRight: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taskBoxDone: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    taskCheck: {
        color: '#FFFFFF',
        fontSize: 8,
        fontFamily: 'IBM Plex Sans',
        fontWeight: 700,
    },
    taskTitle: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 400,
        fontSize: 8.5,
        color: '#374151',
    },
    sectionBox: {
        marginBottom: 14,
    },
    proseBox: {
        backgroundColor: '#f9fafb',
        borderLeftWidth: 2,
        borderLeftColor: '#d1d5db',
        paddingVertical: 5,
        paddingHorizontal: 8,
        marginTop: 4,
    },
    proseText: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 400,
        fontSize: 8.5,
        color: '#374151',
    },
    crewNoteRow: {
        marginBottom: 4,
    },
    crewNoteAuthor: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 700,
        fontSize: 8.5,
        color: '#111827',
    },
    signatureBlock: {
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 4,
        padding: 10,
        backgroundColor: '#fafafa',
    },
    signatureHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    signatureImage: {
        maxWidth: 160,
        maxHeight: 50,
        objectFit: 'contain',
        marginVertical: 4,
    },
    declarationText: {
        fontFamily: 'IBM Plex Sans',
        fontWeight: 400,
        fontSize: 7.5,
        color: '#6b7280',
        marginTop: 6,
        borderTopWidth: 0.5,
        borderTopColor: '#e5e7eb',
        paddingTop: 4,
    },
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 40,
        right: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        fontSize: 7.5,
        color: '#9ca3af',
        borderTopWidth: 0.5,
        borderTopColor: '#e5e7eb',
        paddingTop: 4,
    },
});

export const WorkOrderPdfDocument: React.FC<{ view: WorkOrderView }> = ({ view }) => {
    const { tenant, client, workOrder, lines, totals, tasks, description, crewNotes, signature, labels } = view;

    const signatureDate = new Date(signature.signedAtInstant);

    // Build children of Page with C5 page break and repeating headers
    const pageChildren = [
        // Top accent bar
        h(View, { key: 'topBar', style: [styles.topBar, { backgroundColor: tenant.brandColor }] }),

        // Header row
        h(View, { key: 'headerRow', style: styles.headerRow },
            h(View, { style: styles.tenantBlock },
                tenant.logoPng ? h(Image, { style: styles.logo, src: tenant.logoPng }) : null,
                h(Text, { style: styles.tenantName }, tenant.name),
                tenant.vatNumber ? h(Text, { style: styles.tenantText }, tenant.vatNumber) : null,
                tenant.address ? h(Text, { style: styles.tenantText }, tenant.address) : null
            ),
            h(View, { style: styles.docBlock },
                h(Text, { style: styles.docTitle }, labels.title),
                h(Text, { style: styles.metaText },
                    h(Text, { style: styles.metaTextBold }, `${labels.reference}: `),
                    workOrder.reference
                ),
                h(Text, { style: styles.metaText },
                    h(Text, { style: styles.metaTextBold }, `${labels.date}: `),
                    workOrder.date
                ),
                workOrder.projectName
                    ? h(Text, { style: styles.metaText },
                        h(Text, { style: styles.metaTextBold }, `${labels.project}: `),
                        workOrder.projectName
                    )
                    : null
            )
        ),

        // Client & Site info
        h(View, { key: 'infoGrid', style: styles.infoGrid },
            h(View, { style: styles.infoCol },
                h(Text, { style: styles.infoLabel }, labels.client),
                client
                    ? [
                        h(Text, { key: 'cName', style: styles.infoValueBold }, client.name),
                        client.address ? h(Text, { key: 'cAddr', style: styles.infoValue }, client.address) : null,
                    ]
                    : h(Text, { style: styles.infoValue }, '-')
            ),
            h(View, { style: styles.infoCol },
                h(Text, { style: styles.infoLabel }, labels.siteAddress),
                workOrder.siteAddress
                    ? h(Text, { style: styles.infoValueBold }, workOrder.siteAddress)
                    : h(Text, { style: styles.infoValue }, '-')
            )
        ),

        // Performances Table (repeating header across pages: fixed=true; rows and total protected: wrap=false)
        h(View, { key: 'table', style: styles.table },
            h(Text, { style: styles.sectionTitle }, labels.performances),
            h(View, { style: styles.tableHeaderRow, fixed: true },
                h(Text, { style: [styles.tableHeaderCell, styles.colWorker] }, labels.worker),
                h(Text, { style: [styles.tableHeaderCell, styles.colTime] }, labels.from),
                h(Text, { style: [styles.tableHeaderCell, styles.colTime] }, labels.to),
                h(Text, { style: [styles.tableHeaderCell, styles.colDuration] }, labels.duration)
            ),
            ...lines.map((line, idx) =>
                h(View, { key: idx, style: styles.tableRow, wrap: false },
                    h(Text, { style: [styles.tableCellBold, styles.colWorker] }, line.workerName),
                    h(Text, { style: [styles.tableCell, styles.colTime] }, line.in),
                    h(Text, { style: [styles.tableCell, styles.colTime] }, line.out),
                    h(Text, { style: [styles.tableCell, styles.colDuration] }, line.formattedDuration)
                )
            ),
            h(View, { style: styles.tableTotalRow, wrap: false },
                h(Text, { style: [styles.tableCellBold, styles.colWorker] }, labels.total),
                h(Text, { style: styles.colTime }, ''),
                h(Text, { style: styles.colTime }, ''),
                h(Text, { style: [styles.tableCellBold, styles.colDuration] }, totals.formattedDuration)
            )
        ),

        // Tasks (if present)
        tasks.length > 0
            ? h(View, { key: 'tasks', style: styles.sectionBox },
                h(Text, { style: styles.sectionTitle }, labels.tasks),
                ...tasks.map((task, idx) =>
                    h(View, { key: idx, style: styles.taskRow, wrap: false },
                        h(View, { style: task.done ? [styles.taskBox, styles.taskBoxDone] : styles.taskBox },
                            task.done ? h(Text, { style: styles.taskCheck }, 'v') : null
                        ),
                        h(Text, { style: styles.taskTitle }, task.title)
                    )
                )
            )
            : null,

        // Description (if present)
        description
            ? h(View, { key: 'desc', style: styles.sectionBox },
                h(Text, { style: styles.sectionTitle }, labels.description),
                h(View, { style: styles.proseBox },
                    h(Text, { style: styles.proseText }, description)
                )
            )
            : null,

        // Crew Notes (if present, each row wrap=false)
        crewNotes.length > 0
            ? h(View, { key: 'crewNotes', style: styles.sectionBox },
                h(Text, { style: styles.sectionTitle }, labels.crewNotes),
                ...crewNotes.map((cn, idx) =>
                    h(View, { key: idx, style: styles.crewNoteRow, wrap: false },
                        h(Text, { style: styles.crewNoteAuthor }, `• ${cn.workerName}:`),
                        h(View, { style: styles.proseBox },
                            h(Text, { style: styles.proseText }, cn.note)
                        )
                    )
                )
            )
            : null,

        // Signature Block (wrap=false)
        h(View, { key: 'sig', style: styles.signatureBlock, wrap: false },
            h(Text, { style: styles.sectionTitle }, labels.signature),
            h(View, { style: styles.signatureHeader },
                h(Text, { style: styles.metaText },
                    h(Text, { style: styles.metaTextBold }, `${labels.signedBy}: `),
                    signature.signerName
                ),
                h(Text, { style: styles.metaText },
                    h(Text, { style: styles.metaTextBold }, `${labels.signedAt}: `),
                    signature.signedAtFormatted
                )
            ),
            signature.imagePng ? h(Image, { style: styles.signatureImage, src: signature.imagePng }) : null,
            h(Text, { style: styles.declarationText }, signature.declaration)
        ),

        // Footer (fixed=true)
        h(View, { key: 'footer', style: styles.footer, fixed: true },
            h(Text, null, `${workOrder.reference} — ${signature.signedAtFormatted}`),
            h(Text, {
                render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
                    `${labels.page} ${pageNumber} ${labels.of} ${totalPages}`,
            })
        ),
    ];

    return h(Document, {
        title: `${labels.title} - ${workOrder.reference}`,
        author: tenant.name,
        creator: 'CoralOS',
        producer: 'CoralOS PDF Engine',
        creationDate: signatureDate,
        modificationDate: signatureDate,
    }, h(Page, { size: 'A4', style: styles.page }, pageChildren));
};

let renderLock: Promise<void> = Promise.resolve();

export async function renderSignedWorkOrderPdf(input: SignedWorkOrderPdfInput): Promise<Buffer> {
    // Acquire mutex lock so concurrent renders never interleave Math.random
    const prevLock = renderLock;
    let release!: () => void;
    renderLock = new Promise<void>((resolve) => {
        release = resolve;
    });
    await prevLock;

    try {
        const view = buildWorkOrderView(input);
        const element = WorkOrderPdfDocument({ view });

        // Stabilize PDFKit font subset prefix tag generation (Math.random) for byte determinism (C1)
        const origRandom = Math.random;
        let seed = 0x434f5241; // 'CORA'
        Math.random = () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
        };

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawBuffer = await renderToBuffer(element as any);
            return Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);
        } finally {
            Math.random = origRandom;
        }
    } finally {
        release();
    }
}
