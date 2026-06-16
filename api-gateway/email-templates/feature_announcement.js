import { buildEmailShell } from './base.js';

const PLAN_PERKS = {
  basic: [
    '3-attempt retry logic with 5s backoff',
    '7-day delivery log retention',
    'Higher monthly request quota (100k)',
    'Email support',
  ],
  pro: [
    'Custom headers on outbound webhooks',
    'Broadcast routing — fan out to every destination',
    '100-attempt retry tiers',
    '30-day delivery log retention',
    'Priority email support',
  ],
  plus: [
    'Unlimited monthly requests',
    'Unlimited delivery log retention',
    'Enterprise retry tiers (100 attempts, exponential)',
    'Custom headers + broadcast routing',
    'Dedicated support channel',
  ],
};

export function buildEmail({ displayName, data, unsubscribeUrl, unsubscribeAllUrl, BASE_URL }) {
  const { subject, headline, plan } = data;
  const perks = (plan && PLAN_PERKS[plan.toLowerCase()]) || [];

  const accentColor = '#6c63ff';
  const ctaHref = `${BASE_URL}/dashboard`;

  const perkList = perks.length
    ? `<ul style="margin:0 0 32px;padding:0;list-style:none;">
        ${perks.map((p) => `
          <li style="margin:0 0 12px;padding:12px 16px;background:rgba(108,99,255,0.08);border-left:3px solid ${accentColor};border-radius:6px;color:#cbd5e1;font-size:15px;line-height:1.5;">
            <span style="color:${accentColor};font-weight:700;margin-right:8px;">✓</span> ${p}
          </li>`).join('')}
       </ul>`
    : '';

  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#6c63ff 0%,#3b82f6 100%);padding:40px 48px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:600;">FlowGateway</p>
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">Thank you for subscribing</h1>
      </td>
    </tr>`;

  const body = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#cbd5e1;">Hey <strong style="color:#fff;">${displayName}</strong>,</p>
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;">${headline || 'Your new features are unlocked'}</h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#94a3b8;">Here's what just went live on your account:</p>
    ${perkList}
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="background:linear-gradient(135deg,#6c63ff 0%,#3b82f6 100%);border-radius:8px;">
          <a href="${ctaHref}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Open Dashboard &rarr;</a>
        </td>
      </tr>
    </table>`;

  return {
    subject: subject || 'Your FlowGateway features are unlocked',
    html: buildEmailShell({ header, body, unsubscribeUrl, unsubscribeAllUrl, accentColor }),
  };
}
