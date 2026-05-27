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
      from: 'FlowAPI Security <security@flowgateway.dev>',
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

/**
 * Tier-specific configuration used to build the upgrade email.
 * Each key maps to a plan name from the billing system.
 */
const TIER_CONFIG = {
  basic: {
    label: 'Basic',
    gradient: 'linear-gradient(135deg,#10b981 0%,#059669 100%)',
    accentColor: '#10b981',
    headline: "You're on Basic \u2014 let's go!",
    intro: 'your account has been activated on the <strong style="color:#10b981;">Basic tier</strong>. You now have the foundational toolkit to start routing leads through FlowAPI.',
    features: [
      { icon: '&#x26A1;', title: '5 live webhooks', desc: 'Create up to 5 webhook endpoints for lead ingestion.' },
      { icon: '&#x1F6E1;', title: 'Rate-limited protection', desc: 'Built-in DDoS and spam shielding on every endpoint.' },
      { icon: '&#x1F4CA;', title: 'Lead Ledger access', desc: 'View delivery logs, lead scores, and retry history.' },
      { icon: '&#x1F512;', title: '2FA security', desc: 'TOTP-based two-factor authentication on all destructive actions.' },
    ],
  },
  pro: {
    label: 'Pro',
    gradient: 'linear-gradient(135deg,#6c63ff 0%,#3b82f6 100%)',
    accentColor: '#6c63ff',
    headline: "You're now on Pro &#x1F680;",
    intro: 'your account has been instantly promoted to the <strong style="color:#6c63ff;">Pro tier</strong>. Here\'s what just unlocked for you:',
    features: [
      { icon: '&#x26A1;', title: 'Increased rate limits', desc: 'Up to 50 webhooks and 5 auto-retry attempts per dispatch.' },
      { icon: '&#x1F527;', title: 'Custom headers', desc: 'Configure per-webhook headers for advanced routing and auth.' },
      { icon: '&#x1F4CA;', title: 'Lead Ledger access', desc: 'Full delivery logs, retry history, and live analytics.' },
      { icon: '&#x1F501;', title: 'Exponential backoff retries', desc: 'Failed dispatches auto-retry up to 5&#215; with smart delays.' },
    ],
  },
  plus: {
    label: 'Plus',
    gradient: 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)',
    accentColor: '#f59e0b',
    headline: "Welcome to Plus \u2014 VIP unlocked &#x1F451;",
    intro: 'you now have the <strong style="color:#f59e0b;">Plus tier</strong> \u2014 our most powerful plan. Every limit has been lifted and every feature is at your fingertips.',
    features: [
      { icon: '&#x221E;', title: 'Unlimited webhooks', desc: 'No cap on webhook endpoints \u2014 scale without limits.' },
      { icon: '&#x1F501;', title: '10&#215; exponential retries', desc: 'Maximum resilience with up to 10 automatic retry attempts.' },
      { icon: '&#x1F527;', title: 'Custom headers', desc: 'Full control over per-webhook headers for any integration.' },
      { icon: '&#x2B50;', title: 'Priority support', desc: 'Direct access to the engineering team for urgent issues.' },
    ],
  },
};

/**
 * Builds a feature-row HTML string for the email template.
 */
function buildFeatureRows(features, accentColor) {
  return features
    .map(
      (f, i) =>
        `${i > 0 ? '<tr><td style="height:8px;"></td></tr>' : ''}
        <tr>
          <td style="padding:14px 16px;background:#252540;border-radius:8px;">
            <span style="color:${accentColor};font-size:18px;vertical-align:middle;">${f.icon}</span>
            <span style="margin-left:10px;font-size:15px;color:#e2e8f0;vertical-align:middle;"><strong>${f.title}</strong> &#8212; ${f.desc}</span>
          </td>
        </tr>`
    )
    .join('\n');
}

/**
 * Sends a dynamic tier-upgrade confirmation email.
 *
 * @param {string} userEmail  - Recipient's email address.
 * @param {string} userName   - Recipient's display name (first name or full name).
 * @param {string} newPlan    - The plan key: 'basic', 'pro', or 'plus'.
 * @returns {Promise<{ success: boolean, data?: object, error?: object }>}
 */
export const sendTierUpgradeEmail = async (userEmail, userName, newPlan) => {
  const tier = TIER_CONFIG[newPlan];
  if (!tier) {
    console.error(`[EmailService] Unknown plan "${newPlan}" — skipping upgrade email.`);
    return { success: false, error: `Unknown plan: ${newPlan}` };
  }

  const displayName = userName || 'there';
  const dashboardUrl = `${process.env.BASE_URL || 'https://flowgateway.dev'}/dashboard`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to FlowAPI ${tier.label}</title>
</head>
<body style="margin:0;padding:0;background:#0f0f13;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:${tier.gradient};padding:40px 48px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:600;">FlowAPI Gateway</p>
              <h1 style="margin:0;font-size:32px;font-weight:800;color:#ffffff;line-height:1.2;">${tier.headline}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#cbd5e1;">
                Hey <strong style="color:#ffffff;">${displayName}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#cbd5e1;">
                Thank you for upgrading &#8212; ${tier.intro}
              </p>

              <!-- Feature list -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                ${buildFeatureRows(tier.features, tier.accentColor)}
              </table>

              <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#94a3b8;">
                All changes are live immediately &#8212; head to your dashboard and start building.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:${tier.gradient};border-radius:8px;">
                    <a href="${dashboardUrl}"
                       style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">
                      Open Dashboard &#8594;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px;border-top:1px solid #252540;text-align:center;">
              <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
                You're receiving this because you recently upgraded your FlowAPI account.<br/>
                Questions? Contact us at <a href="mailto:support@flowgateway.dev" style="color:${tier.accentColor};text-decoration:none;">support@flowgateway.dev</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#334155;">&#169; ${new Date().getFullYear()} FlowAPI Gateway. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'FlowAPI Billing <billing@flowgateway.dev>',
      to: userEmail,
      subject: `Welcome to FlowAPI ${tier.label} \uD83D\uDE80`,
      html,
    });

    if (error) {
      console.error(`[EmailService] ${tier.label} upgrade email failed (Resend API):`, error);
      return { success: false, error };
    }

    console.log('[EmailService] %s upgrade email sent to %s — id: %s', tier.label, userEmail, data?.id);
    return { success: true, data };
  } catch (err) {
    console.error(`[EmailService] ${tier.label} upgrade email unexpected error:`, err);
    return { success: false, error: err };
  }
};

/**
 * Backward-compatible alias — calls sendTierUpgradeEmail with 'pro'.
 */
export const sendProUpgradeEmail = (userEmail, userName) =>
  sendTierUpgradeEmail(userEmail, userName, 'pro');

