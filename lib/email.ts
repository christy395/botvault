import { getCloudflareEnv } from "@/lib/cloudflare";

export async function sendVerificationEmail(email: string, token: string) {
  const env = await getCloudflareEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !env.APP_URL) {
    throw new Error("Email is not configured. Set RESEND_API_KEY, EMAIL_FROM, and APP_URL in Cloudflare.");
  }

  const verifyUrl = new URL("/api/auth/verify", env.APP_URL);
  verifyUrl.searchParams.set("token", token);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: "Verify your BotVault email",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#171717"><h1>Welcome to BotVault</h1><p>Confirm this email address to activate your account.</p><p><a href="${verifyUrl.toString()}" style="display:inline-block;padding:12px 18px;background:#7c3aed;color:white;text-decoration:none;border-radius:8px">Verify email</a></p><p>This link expires in 30 minutes. If you did not create a BotVault account, you can ignore this message.</p></div>`,
      text: `Welcome to BotVault! Verify your email using this link: ${verifyUrl.toString()} . This link expires in 30 minutes.`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Email provider rejected verification email:", response.status, detail);
    throw new Error("Could not send the verification email. Check your email provider configuration.");
  }
}
