// Shared Gmail sending helpers for backend functions that send email through
// the connected Gmail OAuth connector. Extracted so printful-shipped-notifier
// and partner-outreach don't each rebuild raw RFC-822 messages + base64url.
//
// Requires the "gmail" app connector to be authorized (gmail.send scope).
// Sender address is resolved from the connected Gmail account's userinfo.

export async function getGmailSender(base44) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection("gmail");
  if (!accessToken) return { token: null, fromEmail: null };
  const profRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profRes.ok) return { token: accessToken, fromEmail: null };
  const email = (await profRes.json()).email;
  return { token: accessToken, fromEmail: email };
}

function base64urlUtf8(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function gmailSendMessage(token, fromEmail, toEmail, toName, subject, body) {
  const to = toName ? `${toName} <${toEmail}>` : toEmail;
  const raw = [
    `From: LOKIN AI <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64urlUtf8(raw) }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gmail send failed (${res.status}): ${t}`);
  }
  return res.json();
}