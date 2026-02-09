import { Resend } from 'resend';

const RECIPIENT_EMAIL = 'contact@coral-group.be';

function getResend() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;
    return new Resend(apiKey);
}

export async function sendLeadNotification(lead: {
    name: string;
    email: string;
    phone?: string | null;
    service: string;
    message?: string | null;
}) {
    const resend = getResend();
    if (!resend) {
        console.warn('RESEND_API_KEY is not set. Skipping email notification.');
        return;
    }

    try {
        await resend.emails.send({
            from: 'Coral Website <onboarding@resend.dev>', // Resend default for unverified domains
            to: RECIPIENT_EMAIL,
            subject: `New Lead: ${lead.name} - ${lead.service}`,
            html: `
                <h2>New Inquiry Received</h2>
                <p><strong>Name:</strong> ${lead.name}</p>
                <p><strong>Email:</strong> ${lead.email}</p>
                <p><strong>Phone:</strong> ${lead.phone || 'N/A'}</p>
                <p><strong>Service:</strong> ${lead.service}</p>
                <p><strong>Message:</strong></p>
                <p>${lead.message || 'No message provided.'}</p>
                <hr />
                <p>This inquiry has also been saved to the database.</p>
            `,
        });
    } catch (error) {
        console.error('Failed to send lead email:', error);
    }
}

export async function sendBookingNotification(booking: {
    clientName: string;
    clientEmail: string;
    serviceType: string;
    date: Date;
    timeSlot: string;
}) {
    const resend = getResend();
    if (!resend) {
        console.warn('RESEND_API_KEY is not set. Skipping email notification.');
        return;
    }

    try {
        await resend.emails.send({
            from: 'Coral Website <onboarding@resend.dev>',
            to: RECIPIENT_EMAIL,
            subject: `Visit Confirmed: ${booking.clientName} - ${booking.date.toLocaleDateString()}`,
            html: `
                <h2>Site Visit Scheduled</h2>
                <p><strong>Client:</strong> ${booking.clientName}</p>
                <p><strong>Email:</strong> ${booking.clientEmail}</p>
                <p><strong>Service:</strong> ${booking.serviceType}</p>
                <p><strong>Date:</strong> ${booking.date.toLocaleDateString()}</p>
                <p><strong>Time Slot:</strong> ${booking.timeSlot}</p>
                <hr />
                <p>This booking has also been saved to the database.</p>
            `,
        });
    } catch (error) {
        console.error('Failed to send booking email:', error);
    }
}
