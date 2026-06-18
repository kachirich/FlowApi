export function buildEmailShell({ header, body, unsubscribeUrl, unsubscribeAllUrl, accentColor = '#6c63ff' }) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#0f0f13;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
          ${header}
          <tr>
            <td style="padding:40px 48px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px;border-top:1px solid #252540;text-align:center;">
              <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
                Questions? <a href="mailto:support@flowgateway.dev" style="color:${accentColor};text-decoration:none;">support@flowgateway.dev</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#334155;">
                <a href="${unsubscribeUrl}" style="color:#475569;text-decoration:underline;">Unsubscribe from this type</a>
                &nbsp;&middot;&nbsp;
                <a href="${unsubscribeAllUrl}" style="color:#475569;text-decoration:underline;">Unsubscribe from all</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#334155;">&copy; ${year} FlowGateway. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
