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

interface TrialNotificationEmailProps {
    type: 'ENDING' | 'EXPIRED';
    companyName: string;
    logoUrl?: string;
    brandColor?: string;
    upgradeUrl: string;
    daysRemaining?: number;
}

export const TrialNotificationEmail = ({
    type = "ENDING",
    companyName = "Coral Enterprises",
    logoUrl,
    brandColor = "#d35400",
    upgradeUrl = "https://app.coral-group.be/admin/settings/billing",
    daysRemaining = 7,
}: TrialNotificationEmailProps) => {
    const isExpired = type === 'EXPIRED';
    
    return (
        <Html>
            <Head />
            <Preview>
                {isExpired 
                    ? `Your trial for ${companyName} has expired` 
                    : `Your trial for ${companyName} ends in ${daysRemaining} days`}
            </Preview>
            <Body style={main}>
                <Container style={container}>
                    {logoUrl && (
                        <Section style={logoSection}>
                            <Img src={logoUrl} width="auto" height="40" alt={companyName} style={logo} />
                        </Section>
                    )}
                    
                    <Heading style={h1}>
                        {isExpired 
                            ? "Your trial has expired" 
                            : "Your trial is ending soon"}
                    </Heading>
                    
                    <Text style={text}>
                        Hi there,
                    </Text>
                    
                    {isExpired ? (
                        <Text style={text}>
                            Your free trial of the <strong>PRO</strong> features for <strong>{companyName}</strong> has expired. 
                            Your account has been downgraded to the <strong>FREE</strong> tier. Don't worry, all your data is still safe!
                        </Text>
                    ) : (
                        <Text style={text}>
                            Your free trial of the <strong>PRO</strong> features for <strong>{companyName}</strong> will end in <strong>{daysRemaining} days</strong>. 
                            Upgrade now to ensure uninterrupted access to your CRM, Projects, and advanced Database features.
                        </Text>
                    )}
                    
                    <Section style={buttonContainer}>
                        <Button
                            style={{ ...button, backgroundColor: brandColor }}
                            href={upgradeUrl}
                        >
                            {isExpired ? "Upgrade Now" : "View Billing Options"}
                        </Button>
                    </Section>
                    
                    <Text style={text}>
                        {isExpired 
                            ? "Upgrade today to regain access to all premium modules." 
                            : "If you have any questions about our plans, feel free to contact our support team."}
                    </Text>
                    
                    <Text style={companyFooter}>
                        Best regards,<br />
                        The CoralOS Team
                    </Text>
                </Container>
            </Body>
        </Html>
    );
};

export default TrialNotificationEmail;

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

const companyFooter = {
    color: '#555',
    fontSize: '16px',
    lineHeight: '26px',
    margin: '32px 0 0',
    borderTop: '1px solid #e6ebf1',
    paddingTop: '24px',
};
