import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Preview,
    Section,
    Text,
} from '@react-email/components';
import * as React from 'react';
import { t } from '@/lib/document-i18n';

interface QuotationEmailProps {
    clientName: string;
    projectName: string;
    quoteTotal: string;
    magicLinkUrl: string;
    customMessage?: string;
    companyName?: string;
    language?: string;
    brandColor?: string;
}

export const QuotationEmail = ({
    clientName = "Client",
    projectName = "Offerte",
    quoteTotal = "€0.00",
    magicLinkUrl = "https://coral-group.be",
    customMessage,
    companyName = "Coral Enterprises",
    language = "nl",
    brandColor = "#d35400",
}: QuotationEmailProps) => {
    const lang = language;
    const body = customMessage || t('email_quote_body', lang);

    return (
        <Html>
            <Head />
            <Preview>{t('email_preview_quote', lang)} — {companyName}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Heading style={h1}>{t('email_quote_heading', lang)}: {projectName}</Heading>

                    <Text style={text}>{t('email_dear', lang)} {clientName},</Text>

                    <Text style={text}>{body}</Text>

                    <Section style={pricingSection}>
                        <Text style={pricingText}>{t('email_quote_total', lang)}:</Text>
                        <Text style={pricingAmount}>{quoteTotal}</Text>
                    </Section>

                    <Section style={buttonContainer}>
                        <Button
                            style={{ ...button, backgroundColor: brandColor }}
                            href={magicLinkUrl}
                        >
                            {t('email_quote_button', lang)}
                        </Button>
                    </Section>

                    <Text style={footerNote}>
                        {t('email_quote_attachment', lang)}
                    </Text>

                    <Text style={companyFooter}>
                        {t('email_regards', lang)},<br />
                        {t('email_team', lang)} {companyName}
                    </Text>
                </Container>
            </Body>
        </Html>
    );
};

export default QuotationEmail;

const main = {
    backgroundColor: '#f6f9fc',
    fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '40px',
    borderRadius: '8px',
    border: '1px solid #eee',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    maxWidth: '600px',
};

const h1 = {
    color: '#333',
    fontSize: '22px',
    fontWeight: 'bold' as const,
    padding: '0',
    margin: '0 0 20px',
};

const text = {
    color: '#555',
    fontSize: '16px',
    lineHeight: '26px',
    margin: '0 0 20px',
};

const pricingSection = {
    backgroundColor: '#f8fafc',
    padding: '24px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    margin: '20px 0',
    textAlign: 'center' as const,
};

const pricingText = {
    color: '#64748b',
    fontSize: '14px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    margin: '0 0 8px',
};

const pricingAmount = {
    color: '#0f172a',
    fontSize: '32px',
    fontWeight: 'bold' as const,
    margin: '0',
};

const buttonContainer = {
    textAlign: 'center' as const,
    margin: '32px 0',
};

const button = {
    borderRadius: '6px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    padding: '14px 28px',
};

const footerNote = {
    color: '#8898aa',
    fontSize: '14px',
    marginTop: '32px',
    fontStyle: 'italic' as const,
};

const companyFooter = {
    color: '#555',
    fontSize: '16px',
    lineHeight: '26px',
    margin: '32px 0 0',
    borderTop: '1px solid #e6ebf1',
    paddingTop: '24px',
};
