import { Html, Head, Body, Container, Text, Heading, Section } from '@react-email/components';

interface OtpEmailProps {
  name: string;
  otp: string;
}

export function OtpVerificationEmail({ name, otp }: OtpEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily: 'Arial, sans-serif', padding: '40px 0' }}>
        <Container style={{ maxWidth: '480px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '12px', padding: '40px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <Heading style={{ textAlign: 'center' as const, color: '#1a1a1a', fontSize: '24px', marginBottom: '8px' }}>
            Xác thực tài khoản
          </Heading>
          <Text style={{ color: '#4b5563', fontSize: '16px', lineHeight: '24px' }}>
            Xin chào <strong>{name}</strong>,
          </Text>
          <Text style={{ color: '#4b5563', fontSize: '16px', lineHeight: '24px' }}>
            Mã xác thực của bạn là:
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
            <Text style={{ fontSize: '36px', fontWeight: 'bold', letterSpacing: '8px', color: '#2563eb', backgroundColor: '#eff6ff', padding: '16px 32px', borderRadius: '12px', display: 'inline-block' }}>
              {otp}
            </Text>
          </Section>
          <Text style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center' as const }}>
            Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
