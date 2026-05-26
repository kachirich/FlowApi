import nodemailer from 'nodemailer';

let transporter;

const initializeTransporter = async () => {
  if (!process.env.EMAIL_USER) {
    throw new Error('Missing EMAIL_USER');
  }

  if (!process.env.EMAIL_PASS) {
    throw new Error('Missing EMAIL_PASS');
  }

  if (process.env.EMAIL_PASS.includes(' ')) {
    throw new Error('EMAIL_PASS contains spaces. Google App Passwords must be a single 16-character string.');
  }

  if (process.env.EMAIL_PASS.length !== 16) {
    throw new Error('EMAIL_PASS is the wrong length. It must be exactly 16 characters.');
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  console.log(`[EmailService] Engine ready for ${process.env.EMAIL_USER} (Password length validated).`);
};

export const sendEmailVerification = async (to, code, reason = 'login') => {
  if (!transporter) await initializeTransporter();
  
  let subject, textBody;

  if (reason === 'reset') {
    subject = 'FlowAPI Password Reset Request';
    textBody = `You requested a password reset. Here is your code to authorize the change: ${code}. If you did not request this, secure your account immediately.`;
  } else {
    subject = 'Your FlowAPI Login Code';
    textBody = `Here is your secure code to log in to your dashboard: ${code}. If you did not request this, please ignore.`;
  }
  
  const info = await transporter.sendMail({
    from: '"FlowAPI Security" <security@flowapi.com>',
    to,
    subject,
    text: textBody,
    html: `<p>${textBody}</p>`,
  });

  console.log('[EmailService] Message sent: %s', info.messageId);
  return info;
};
