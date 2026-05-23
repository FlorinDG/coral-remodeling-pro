import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY || 're_Yh79tTVY_MPrunncw2bKrRBvEs9E1haSY';
console.log("Testing Resend API...");
console.log(`API Key prefix: ${apiKey.substring(0, 7)}...`);

const resend = new Resend(apiKey);

async function main() {
    try {
        console.log("Sending test email using Resend...");
        const result = await resend.emails.send({
            from: 'CoralOS <noreply@coral-group.be>',
            to: 'tfo@coral-group.be',
            subject: 'CoralOS - Resend Configuration Test',
            html: `
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
                    <h2>Resend Integration Test</h2>
                    <p>If you received this email, the Resend integration is working perfectly on the current domain/API key setup.</p>
                    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                </div>
            `
        });

        console.log("Resend API Response:", result);
        if (result.error) {
            console.error("Resend returned an error:", result.error);
        } else {
            console.log("Email successfully sent! Message ID:", result.data?.id);
        }
    } catch (e) {
        console.error("Catch block error during Resend test:", e);
    }
}

main();
