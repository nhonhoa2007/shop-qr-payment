import { Html, Head, Body, Container, Text, Heading, Section } from '@react-email/components';

interface PasswordResetEmailProps {
  name: string;
  otp: string;
}

export function PasswordResetEmail({ name, otp }: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily: 'Arial, sans-serif', padding: '40px 0' }}>
        <Container
          style={{
            maxWidth: '480px',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '40px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <Heading
            style={{
              textAlign: 'center' as const,
              color: '#1a1a1a',
              fontSize: '24px',
              marginBottom: '16px',
            }}
          >
            Đặt lại mật khẩu
          </Heading>
          <Text style={{ color: '#4b5563', fontSize: '16px', lineHeight: '24px', margin: '0 0 12px 0' }}>
            Xin chào <strong>{name}</strong>,
          </Text>
          <Text style={{ color: '#4b5563', fontSize: '16px', lineHeight: '24px', margin: '0 0 20px 0' }}>
            Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại <strong>Shop QR Payment</strong>. Mã xác thực OTP của bạn là:
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
            <Text
              style={{
                fontSize: '36px',
                fontWeight: 'bold',
                letterSpacing: '8px',
                color: '#dc2626',
                backgroundColor: '#fef2f2',
                border: '1px solid #fee2e2',
                padding: '16px 32px',
                borderRadius: '12px',
                display: 'inline-block',
                margin: '0 auto',
              }}
            >
              {otp}
            </Text>
          </Section>
          <Text
            style={{
              color: '#ef4444',
              fontSize: '14px',
              lineHeight: '20px',
              textAlign: 'center' as const,
              fontWeight: 500,
              margin: '0 0 8px 0',
            }}
          >
            Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai!
          </Text>
          <Text
            style={{
              color: '#9ca3af',
              fontSize: '13px',
              lineHeight: '18px',
              textAlign: 'center' as const,
              margin: '0',
            }}
          >
            Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể yên tâm bỏ qua email này. Tài khoản của bạn vẫn được an toàn.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
