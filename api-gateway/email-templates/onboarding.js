import { buildEmailShell } from './base.js';

const DAYS = {
  0: {
    subject: "Welcome to FlowGateway — here's how to get started",
    headline: 'Welcome aboard',
    intro: "Your account is live. FlowGateway routes incoming leads — from GoHighLevel or any CRM — to your destinations with smart retry logic and real-time delivery tracking.",
    prompt: '<strong style="color:#fff;">Three things to do first:</strong>',
    steps: [
      { icon: '🔗', text: 'Create your first <strong>Webhook endpoint</strong> from the Webhooks tab' },
      { icon: '🎯', text: 'Add a <strong>Destination</strong> — the URL where your leads get forwarded' },
      { icon: '📊', text: 'Send a test payload and watch it appear in the <strong>Lead Ledger</strong>' },
    ],
    cta: 'Get Started',
  },
  3: {
    subject: 'Are your leads flowing?',
    headline: 'A quick check-in',
    intro: "It's been 3 days since you joined FlowGateway. If you haven't routed your first lead yet, here are the two features most users discover on day 3:",
    prompt: null,
    steps: [
      { icon: '🔁', text: '<strong>Round-Robin routing</strong> — automatically balance leads across multiple destinations' },
      { icon: '📡', text: '<strong>Broadcast mode</strong> — send the same lead to every destination simultaneously' },
    ],
    cta: 'Open Dashboard',
  },
  7: {
    subject: "You've been on FlowGateway for a week",
    headline: 'One week in',
    intro: "You've had FlowGateway for 7 days. Here's what most power users unlock in their first week:",
    prompt: null,
    steps: [
      { icon: '⚡', text: '<strong>Retry logic</strong> — failed deliveries automatically retry with exponential backoff' },
      { icon: '🛡️', text: '<strong>Lead scoring</strong> — every lead gets a 0–100 quality score based on email, phone, and company data' },
      { icon: '🔑', text: '<strong>API keys</strong> — integrate directly from your CRM or code without webhooks' },
    ],
    cta: 'Explore Features',
  },
};

export function buildEmail({ displayName, data, unsubscribeUrl, unsubscribeAllUrl, BASE_URL }) {
  const day = data?.day ?? 0;
  const cfg = DAYS[day] || DAYS[0];
  const accentColor = '#10b981';

  const header = `
    <tr>
      <td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:40px 48px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:600;">FlowGateway</p>
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">${cfg.headline}</h1>
      </td>
    </tr>`;

  const stepsHtml = cfg.steps.map(s =>
    `<tr>
       <td style="padding:12px 16px;background:#252540;border-radius:8px;">
         <span style="font-size:18px;vertical-align:middle;">${s.icon}</span>
         <span style="margin-left:10px;font-size:15px;color:#e2e8f0;vertical-align:middle;">${s.text}</span>
       </td>
     </tr>
     <tr><td style="height:8px;"></td></tr>`
  ).join('');

  const body = `
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#cbd5e1;">Hey <strong style="color:#fff;">${displayName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#94a3b8;">${cfg.intro}</p>
    ${cfg.prompt ? `<p style="margin:0 0 16px;font-size:15px;color:#94a3b8;">${cfg.prompt}</p>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
      ${stepsHtml}
    </table>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:8px;">
          <a href="${BASE_URL}/dashboard" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${cfg.cta} &rarr;</a>
        </td>
      </tr>
    </table>`;

  return {
    subject: cfg.subject,
    html: buildEmailShell({ header, body, unsubscribeUrl, unsubscribeAllUrl, accentColor }),
  };
}
