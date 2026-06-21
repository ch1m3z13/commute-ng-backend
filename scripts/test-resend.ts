import { Resend } from 'resend';

const RESEND_API_KEY = 're_GiBohbRN_5MwYun7h7aeqbcQKH3F3E395';
const resend = new Resend(RESEND_API_KEY);

async function sendTestEmail(to: string) {
  console.log(`Sending test email to: ${to}`);

  const { data, error } = await resend.emails.send({
    from: 'CommuteNG <onboarding@resend.dev>',
    to,
    subject: 'CommuteNG — Test Email',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h1 style="font-size: 24px; font-weight: 700; color: #16a34a; margin: 0 0 16px;">CommuteNG</h1>
        <p style="font-size: 14px; color: #374151;">Resend sandbox is configured. This is a test email from your CommuteNG backend.</p>
      </div>
    `,
  });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Email sent. ID:', data?.id);
}

const recipient = process.argv[2];
if (!recipient) {
  console.log('Usage: npx tsx scripts/test-resend.ts <email>');
  console.log('Example: npx tsx scripts/test-resend.ts your@email.com');
  process.exit(1);
}

sendTestEmail(recipient);
