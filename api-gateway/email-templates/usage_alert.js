import { buildEmailShell } from './base.js';

export function buildEmail({ displayName, data, unsubscribeUrl, unsubscribeAllUrl, BASE_URL }) {
  const { threshold, current, limit } = data;
  const isCapped = threshold >= 100;
  const accentColor = isCapped ? '#ef4444' : '#f59e0b';
  const gradient = isCapped
    ? 'linear-gradient(135deg,#ef4444 0%,#dc2626 100%)'
    : 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)';

  const headline = isCapped ? 'Monthly quota reached' : "80% of your monthly quota used";
  const emailSubject = isCapped
    ? 'Action needed: your FlowGateway quota is full'
    : "Heads up: you're at 80% of your monthly quota";

  const message = isCapped
    ? `Your account has processed <strong style="color:#fff;">${Number(current).toLocaleString()}</strong> requests this month, hitting your plan limit of <strong style="color:#fff;">${Number(limit).toLocaleString()}</strong>. New leads will be rejected until you upgrade or your billing cycle resets.`
    : `Your account has processed <strong style="color:#fff;">${Number(current).toLocaleString()}</strong> of your <strong style="color:#fff;">${Number(limit).toLocaleString()}</strong> monthly requests. At your current pace you may hit the cap before your cycle resets.`;

  const header = `
    <tr>
      <td style="background:${gradient};padding:40px 48px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:600;">Usage Alert</p>
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">${headline}</h1>
      </td>
    </tr>`;

  const body = `
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#cbd5e1;">Hey <strong style="color:#fff;">${displayName}</strong>,</p>
    <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#94a3b8;">${message}</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="background:${gradient};border-radius:8px;">
          <a href="${BASE_URL}/dashboard" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
            ${isCapped ? 'Upgrade Now' : 'View Usage'} &rarr;
          </a>
        </td>
      </tr>
    </table>`;

  return {
    subject: emailSubject,
    html: buildEmailShell({ header, body, unsubscribeUrl, unsubscribeAllUrl, accentColor }),
  };
}
