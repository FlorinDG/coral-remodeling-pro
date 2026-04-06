import { Resend } from 'resend';

const RECIPIENT_EMAIL = 'info@coral-group.be';

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
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
        await resend.emails.send({
            from: `Coral Remodeling <${fromEmail}>`,
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
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
        await resend.emails.send({
            from: `Coral Remodeling <${fromEmail}>`,
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

export async function sendVerificationEmail(params: {
    to: string;
    name: string;
    verificationUrl: string;
}) {
    const resend = getResend();
    if (!resend) {
        console.warn('[Verification] RESEND_API_KEY is not set. Printing verification URL to console instead.');
        console.log(`[Verification] URL for ${params.to}: ${params.verificationUrl}`);
        return;
    }

    try {
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
        await resend.emails.send({
            from: `CoralOS <${fromEmail}>`,
            to: params.to,
            subject: 'Verify your CoralOS account',
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <h1 style="font-size: 24px; font-weight: 800; color: #111; margin: 0;">CoralOS</h1>
                        <p style="color: #888; font-size: 12px; margin-top: 4px;">The workspace for modern contractors</p>
                    </div>
                    <h2 style="font-size: 18px; font-weight: 700; color: #111; margin-bottom: 8px;">Welcome, ${params.name}!</h2>
                    <p style="color: #555; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
                        Your workspace has been provisioned. Please verify your email address to secure your account.
                    </p>
                    <div style="text-align: center; margin: 32px 0;">
                        <a href="${params.verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block;">
                            Verify Email Address
                        </a>
                    </div>
                    <p style="color: #999; font-size: 11px; text-align: center; margin-top: 32px;">
                        This link expires in 3 days. If you did not create this account, you can safely ignore this email.
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                    <p style="color: #bbb; font-size: 10px; text-align: center;">
                        © ${new Date().getFullYear()} Coral Group · coral-group.be
                    </p>
                </div>
            `,
        });
        console.log(`[Verification] Email sent to ${params.to}`);
    } catch (error) {
        console.error('[Verification] Failed to send email:', error);
        // Fallback: log the URL so verification is still possible
        console.log(`[Verification] Fallback URL for ${params.to}: ${params.verificationUrl}`);
    }
}
