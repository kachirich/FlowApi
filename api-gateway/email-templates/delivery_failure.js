import { buildEmailShell } from './base.js';

export function buildEmail({ displayName, data, unsubscribeUrl, unsubscribeAllUrl, BASE_URL }) {
  const { destination_name, lead_email, attempts, error_message } = data;
  const accentColor = '#ef4444';

  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);padding:40px 48px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:600;">Delivery Alert</p>
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">Lead delivery failed</h1>
      </td>
    </tr>`;

  const body = `
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#cbd5e1;">Hey <strong style="color:#fff;">${displayName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#94a3b8;">
      A lead could not be delivered to <strong style="color:#fff;">${destination_name || 'your destination'}</strong> after
      <strong style="color:#fff;">${attempts}</strong> attempt${Number(attempts) !== 1 ? 's' : ''}.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
      <tr>
        <td style="padding:16px;background:#252540;border-radius:8px;">
          ${lead_email ? `<p style="margin:0 0 8px;font-size:14px;color:#94a3b8;"><span style="color:#64748b;">Lead:</span> <strong style="color:#e2e8f0;">${lead_email}</strong></p>` : ''}
          <p style="margin:0;font-size:13px;color:#64748b;font-family:monospace;word-break:break-all;">${error_message || 'Unknown error'}</p>
        </td>
      </tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);border-radius:8px;">
          <a href="${BASE_URL}/dashboard" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">View Lead Ledger &rarr;</a>
        </td>
      </tr>
    </table>`;

  return {
    subject: `Lead delivery failed — ${destination_name || 'destination'} unreachable`,
    html: buildEmailShell({ header, body, unsubscribeUrl, unsubscribeAllUrl, accentColor }),
  };
}
