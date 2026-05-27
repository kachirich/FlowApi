import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmailVerification = async (to, code, reason = 'login') => {
  let subject, textBody;

  if (reason === 'reset') {
    subject = 'FlowAPI Password Reset Request';
    textBody = `You requested a password reset. Here is your code to authorize the change: ${code}. If you did not request this, secure your account immediately.`;
  } else {
    subject = 'Your FlowAPI Login Code';
    textBody = `Here is your secure code to log in to your dashboard: ${code}. If you did not request this, please ignore.`;
  }
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to,
      subject,
      text: textBody,
      html: `<p>${textBody}</p>`,
    });

    if (error) {
      console.error('[EmailService] Resend API Error:', error);
      return { success: false, error };
    }

    console.log('[EmailService] Message sent: %s', data?.id);
    return { success: true, data };
  } catch (err) {
    console.error('[EmailService] Unexpected Error:', err);
    return { success: false, error: err };
  }
};
