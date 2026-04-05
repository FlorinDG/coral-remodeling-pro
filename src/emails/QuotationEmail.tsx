import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Preview,
    Section,
    Text,
} from '@react-email/components';
import * as React from 'react';

interface QuotationEmailProps {
    clientName: string;
    projectName: string;
    quoteTotal: string;
    magicLinkUrl: string;
    customMessage?: string;
    companyName?: string;
}

export const QuotationEmail = ({
    clientName = "Client",
    projectName = "Your Project",
    quoteTotal = "€0.00",
    magicLinkUrl = "https://coralremodeling.be",
    customMessage = "Please find your custom quotation attached. You can review the details and securely sign online.",
    companyName = "Coral Remodeling Pro",
}: QuotationEmailProps) => (
    <Html>
        <Head />
        <Preview>Your quotation from {companyName} is ready.</Preview>
        <Body style={main}>
            <Container style={container}>
                <Heading style={h1}>Offerte: {projectName}</Heading>

                <Text style={text}>Beste {clientName},</Text>

                <Text style={text}>
                    {customMessage}
                </Text>

                <Section style={pricingSection}>
                    <Text style={pricingText}>Totale Investering:</Text>
                    <Text style={pricingAmount}>{quoteTotal}</Text>
                </Section>

                <Section style={buttonContainer}>
                    <Button
                        style={button}
                        href={magicLinkUrl}
                    >
                        Bekijk en Teken Online
                    </Button>
                </Section>

                <Text style={footerText}>
                    A PDF copy of this quotation is securely attached to this email thread for your records.
                </Text>

                <Text style={companyFooter}>
                    Met vriendelijke groeten,<br />
                    Het team van {companyName}
                </Text>
            </Container>
        </Body>
    </Html>
);

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
    fontSize: '24px',
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    margin: '0',
};

const buttonContainer = {
    textAlign: 'center' as const,
    margin: '32px 0',
};

const button = {
    backgroundColor: '#d75d00',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    padding: '14px 28px',
};

const footerText = {
    color: '#8898aa',
    fontSize: '14px',
    marginTop: '32px',
    fontStyle: 'italic',
};

const companyFooter = {
    color: '#555',
    fontSize: '16px',
    lineHeight: '26px',
    margin: '32px 0 0',
    borderTop: '1px solid #e6ebf1',
    paddingTop: '24px',
};
