import { buildEmailShell } from './base.js';

const CONFIGS = {
  payment_failed: {
    subject: 'Payment failed — action required',
    headline: 'Payment failed',
    gradient: 'linear-gradient(135deg,#ef4444 0%,#dc2626 100%)',
    accentColor: '#ef4444',
    getMessage: ({ amount }) =>
      `We were unable to process your payment${amount ? ` of <strong style="color:#fff;">${amount}</strong>` : ''}. Please update your payment method to avoid service interruption.`,
    cta: 'Update Payment Method',
  },
  trial_ending: {
    subject: 'Your trial ends soon',
    headline: 'Trial ending soon',
    gradient: 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)',
    accentColor: '#f59e0b',
    getMessage: ({ trial_ends_at }) =>
      `Your FlowGateway trial${trial_ends_at ? ` ends on <strong style="color:#fff;">${trial_ends_at}</strong>` : ' is ending soon'}. Add a payment method to keep your plan active.`,
    cta: 'Activate Subscription',
  },
  subscription_cancelled: {
    subject: 'Your subscription has been cancelled',
    headline: 'Subscription cancelled',
    gradient: 'linear-gradient(135deg,#64748b 0%,#475569 100%)',
    accentColor: '#64748b',
    getMessage: () =>
      'Your FlowGateway subscription has been cancelled. Your account will revert to the Free tier at the end of your current billing period.',
    cta: 'Reactivate',
  },
};

export function buildEmail({ displayName, data, unsubscribeUrl, unsubscribeAllUrl, BASE_URL }) {
  const { event } = data;
  const cfg = CONFIGS[event] || CONFIGS.payment_failed;
  const message = cfg.getMessage(data);

  const header = `
    <tr>
      <td style="background:${cfg.gradient};padding:40px 48px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:600;">Billing</p>
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">${cfg.headline}</h1>
      </td>
    </tr>`;

  const body = `
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#cbd5e1;">Hey <strong style="color:#fff;">${displayName}</strong>,</p>
    <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#94a3b8;">${message}</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="background:${cfg.gradient};border-radius:8px;">
          <a href="${BASE_URL}/dashboard" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${cfg.cta} &rarr;</a>
        </td>
      </tr>
    </table>`;

  return {
    subject: cfg.subject,
    html: buildEmailShell({ header, body, unsubscribeUrl, unsubscribeAllUrl, accentColor: cfg.accentColor }),
  };
}
