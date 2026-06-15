import { buildEmailShell } from './base.js';

export function buildEmail({ displayName, data, unsubscribeUrl, unsubscribeAllUrl, BASE_URL }) {
  const {
    leads_received = 0,
    leads_delivered = 0,
    leads_failed = 0,
    top_destination,
  } = data;

  const deliveryRate = leads_received > 0
    ? Math.round((leads_delivered / leads_received) * 100)
    : 0;

  const accentColor = '#6c63ff';

  const stats = [
    { label: 'Received', value: Number(leads_received).toLocaleString(), color: '#6c63ff' },
    { label: 'Delivered', value: Number(leads_delivered).toLocaleString(), color: '#10b981' },
    { label: 'Failed', value: Number(leads_failed).toLocaleString(), color: leads_failed > 0 ? '#ef4444' : '#64748b' },
    { label: 'Delivery Rate', value: `${deliveryRate}%`, color: deliveryRate >= 90 ? '#10b981' : '#f59e0b' },
  ];

  const statCells = stats.map(s => `
    <td style="text-align:center;padding:16px 12px;background:#252540;border-radius:8px;">
      <p style="margin:0;font-size:22px;font-weight:800;color:${s.color};">${s.value}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">${s.label}</p>
    </td>
    <td style="width:6px;"></td>`
  ).join('');

  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#6c63ff 0%,#3b82f6 100%);padding:40px 48px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:600;">Weekly Digest</p>
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">Your week in leads</h1>
      </td>
    </tr>`;

  const body = `
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#cbd5e1;">Hey <strong style="color:#fff;">${displayName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#94a3b8;">Here's your FlowGateway activity for the past 7 days:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
      <tr>${statCells}</tr>
    </table>
    ${top_destination ? `<p style="margin:0 0 28px;font-size:14px;color:#64748b;">Top destination this week: <strong style="color:#e2e8f0;">${top_destination}</strong></p>` : ''}
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="background:linear-gradient(135deg,#6c63ff 0%,#3b82f6 100%);border-radius:8px;">
          <a href="${BASE_URL}/dashboard" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">View Full Report &rarr;</a>
        </td>
      </tr>
    </table>`;

  return {
    subject: `Your FlowGateway digest — ${Number(leads_received).toLocaleString()} leads this week`,
    html: buildEmailShell({ header, body, unsubscribeUrl, unsubscribeAllUrl, accentColor }),
  };
}
