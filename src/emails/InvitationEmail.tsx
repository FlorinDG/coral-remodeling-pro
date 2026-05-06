import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Preview,
    Section,
    Text,
} from '@react-email/components';
import * as React from 'react';

interface InvitationEmailProps {
    inviterName: string;
    companyName: string;
    logoUrl?: string;
    brandColor?: string;
    acceptUrl: string;
}

export const InvitationEmail = ({
    inviterName = "A team member",
    companyName = "Coral Enterprises",
    logoUrl,
    brandColor = "#d35400",
    acceptUrl = "https://app.coral-group.be",
}: InvitationEmailProps) => {
    return (
        <Html>
            <Head />
            <Preview>Join {companyName} on CoralOS</Preview>
            <Body style={main}>
                <Container style={container}>
                    {logoUrl && (
                        <Section style={logoSection}>
                            <Img src={logoUrl} width="auto" height="40" alt={companyName} style={logo} />
                        </Section>
                    )}
                    
                    <Heading style={h1}>Welcome to the team!</Heading>
                    
                    <Text style={text}>
                        Hi there,
                    </Text>
                    
                    <Text style={text}>
                        <strong>{inviterName}</strong> has invited you to join the <strong>{companyName}</strong> team on CoralOS.
                        CoralOS is your central hub for managing projects, invoices, and client relations.
                    </Text>
                    
                    <Section style={buttonContainer}>
                        <Button
                            style={{ ...button, backgroundColor: brandColor }}
                            href={acceptUrl}
                        >
                            Accept Invitation
                        </Button>
                    </Section>
                    
                    <Text style={text}>
                        If you have any questions, please reach out to your team administrator.
                    </Text>
                    
                    <Text style={footerNote}>
                        This invitation link will expire in 7 days.
                    </Text>
                    
                    <Text style={companyFooter}>
                        Best regards,<br />
                        The {companyName} Team
                    </Text>
                </Container>
            </Body>
        </Html>
    );
};

export default InvitationEmail;

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

const logoSection = {
    marginBottom: '32px',
};

const logo = {
    margin: '0 auto',
};

const h1 = {
    color: '#333',
    fontSize: '22px',
    fontWeight: 'bold' as const,
    padding: '0',
    margin: '0 0 20px',
    textAlign: 'center' as const,
};

const text = {
    color: '#555',
    fontSize: '16px',
    lineHeight: '26px',
    margin: '0 0 20px',
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
