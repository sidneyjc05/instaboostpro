import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";

// The Mailersend API token from the user - defaults to empty string so new MailerSend doesn't crash here if empty
// although we check it later.
const API_TOKEN = process.env.MAILERSEND_API_TOKEN || process.env.API_KEY || ''; 
const FROM_DOMAIN = process.env.MAILERSEND_DOMAIN || 'test-eqvygm07v7zl0p7w.mlsender.net';
const FROM_EMAIL = process.env.FROM_EMAIL || `suporte@${FROM_DOMAIN}`;

export async function sendVerificationEmail(toEmail: string, code: string, type: 'recovery' | 'login' | 'verify') {
  let subject = '';
  let text = '';
  
  if (type === 'recovery') {
    subject = 'InstaBoost PRO - Recuperação de Senha';
    text = `Você solicitou a recuperação de senha. Seu código de segurança é: ${code}\n\nEste código é válido por 15 minutos. Caso não tenha solicitado, ignore este email.`;
  } else if (type === 'login') {
    subject = 'InstaBoost PRO - Tentativa de Acesso';
    text = `Detectamos um acesso de um novo dispositivo à sua conta. Para continuar, insira o código de segurança a seguir:\n\nCódigo: ${code}\n\nEste código é válido por 15 minutos.`;
  } else if (type === 'verify') {
    subject = 'InstaBoost PRO - Verificação de E-mail';
    text = `Para confirmar a vinculação do seu endereço de e-mail e proteger sua conta, utilize o seguinte código de segurança:\n\nCódigo: ${code}\n\nEste código é válido por 15 minutos.`;
  }

  const html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px;">
      <h2 style="color: #333; margin-bottom: 20px;">InstaBoost PRO</h2>
      <p style="color: #555; line-height: 1.5; font-size: 16px;">${text.replace(/\n\n/g, '<br/><br/>').replace(code, `<strong><span style="font-size: 24px; letter-spacing: 4px; display: inline-block; padding: 10px 0; color: #000;">${code}</span></strong>`)}</p>
  </div>`;

  try {
    if (API_TOKEN) {
        const mailerSend = new MailerSend({
          apiKey: API_TOKEN,
        });

        const sentFrom = new Sender(FROM_EMAIL, "InstaBoost PRO Segurança");
        const recipients = [new Recipient(toEmail, "Cliente")];

        const emailParams = new EmailParams()
          .setFrom(sentFrom)
          .setTo(recipients)
          .setSubject(subject)
          .setHtml(html)
          .setText(text);

        await mailerSend.email.send(emailParams);
        
        console.log(`[Mailer] E-mail enviado com sucesso via API Mailersend para ${toEmail}`);
        return { success: true };
    }

    // Fallback: print to console and bypass if no KEY is found.
    console.warn(`[Mailer] Nenhuma configuração de servidor de E-mail fornecida (API_KEY ou MAILERSEND_API_TOKEN). Bypass ativado. O Código gerado foi: ${code}`);
    return { success: true, bypassed: true };

  } catch (err) {
    console.error('[Mailer] Erro sistêmico ao enviar email:', err);
    return { success: false, reason: 'error' };
  }
}

