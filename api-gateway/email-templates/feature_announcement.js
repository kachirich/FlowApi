import { buildEmailShell } from './base.js';

const PLAN_PERKS = {
  basic: [
    '3-attempt retries on failed deliveries',
    '7-day log retention',
    'Round-robin routing across destinations',
  ],
  pro: [
    'Custom headers on webhook destinations',
    'Broadcast routing — deliver to all destinations simultaneously',
    '100-attempt retries with exponential backoff',
    '30-day log retention',
  ],
  plus: [
    'Everything in Growth',
    'Unlimited log retention',
    'Enterprise retry tiers (100 attempts)',
    'Priority support',
  ],
};

export function buildEmail({ displayName, data, unsubscribeUrl, unsubscribeAllUrl, BASE_URL }) {
  const { subject, headline, plan, body_html, cta_label = 'Open Dashboard', cta_url } = data;
  const accentColor = '#6c63ff';
  const ctaHref = cta_url || `${BASE_URL}/dashboard`;

  const perks = PLAN_PERKS[plan] || [];
  const perksHtml = perks.length
    ? `<ul style="padding:0;margin:0 0 32px;list-style:none;">${perks
        .map(
          (p) =>
            `<li style="padding:6px 0;font-size:15px;color:#cbd5e1;display:flex;align-items:flex-start;gap:8px;">` +
            `<span style="color:#f59e0b;font-weight:700;flex-shrink:0;">✓</span> ${p}</li>`
        )
        .join('')}</ul>`
    : body_html
    ? `<div style="font-size:15px;line-height:1.8;color:#94a3b8;margin:0 0 32px;">${body_html}</div>`
    : '';

  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#6c63ff 0%,#3b82f6 100%);padding:40px 48px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:600;">FlowGateway</p>
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">Your New Features Are Live</h1>
      </td>
    </tr>`;

  const body = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#cbd5e1;">Hey <strong style="color:#fff;">${displayName}</strong>,</p>
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;">${headline}</h2>
    ${perksHtml}
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="background:linear-gradient(135deg,#6c63ff 0%,#3b82f6 100%);border-radius:8px;">
          <a href="${ctaHref}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${cta_label} &rarr;</a>
        </td>
      </tr>
    </table>`;

  return {
    subject: subject || "Your new FlowGateway features are live",
    html: buildEmailShell({ header, body, unsubscribeUrl, unsubscribeAllUrl, accentColor }),
  };
}
