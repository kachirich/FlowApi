import { buildEmailShell } from './base.js';

export function buildEmail({ displayName, data, unsubscribeUrl, unsubscribeAllUrl, BASE_URL }) {
  const { subject, headline, body_html, cta_label = 'Open Dashboard', cta_url } = data;
  const accentColor = '#6c63ff';
  const ctaHref = cta_url || `${BASE_URL}/dashboard`;

  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#6c63ff 0%,#3b82f6 100%);padding:40px 48px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:600;">FlowGateway</p>
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">What's New</h1>
      </td>
    </tr>`;

  const body = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#cbd5e1;">Hey <strong style="color:#fff;">${displayName}</strong>,</p>
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;">${headline}</h2>
    <div style="font-size:15px;line-height:1.8;color:#94a3b8;margin:0 0 32px;">${body_html}</div>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="background:linear-gradient(135deg,#6c63ff 0%,#3b82f6 100%);border-radius:8px;">
          <a href="${ctaHref}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${cta_label} &rarr;</a>
        </td>
      </tr>
    </table>`;

  return {
    subject: subject || "What's new on FlowGateway",
    html: buildEmailShell({ header, body, unsubscribeUrl, unsubscribeAllUrl, accentColor }),
  };
}
