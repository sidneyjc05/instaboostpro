import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const API_URL = 'https://api.mailersend.com/v1/email';
const API_TOKEN = process.env.MAILERSEND_API_TOKEN;
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
    // 1. Try SMTP if configured
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });

        await transporter.sendMail({
            from: `"InstaBoost PRO Segurança" <${FROM_EMAIL}>`,
            to: toEmail,
            subject: subject,
            text: text,
            html: html,
        });

        console.log(`[Mailer] E-mail enviado com sucesso via SMTP para ${toEmail}`);
        return { success: true };
    }

    // 2. Try Mailersend if configured
    if (API_TOKEN) {
        const payload = {
            from: { email: FROM_EMAIL, name: "InstaBoost PRO Segurança" },
            to: [{ email: toEmail }],
            subject: subject,
            text: text,
            html: html
        };

        let response;
        if (typeof fetch === 'undefined') {
            const nodeFetch = (await import('node-fetch')).default as any;
            response = await nodeFetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Authorization': `Bearer ${API_TOKEN}`
                },
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Authorization': `Bearer ${API_TOKEN}`
                },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            const respErr = await response.text();
            console.error('[Mailer] Erro ao enviar email pela API Mailersend:', response.status, respErr);
            return { success: false, reason: 'api_error' };
        }
        
        console.log(`[Mailer] E-mail enviado com sucesso via API Mailersend para ${toEmail}`);
        return { success: true };
    }

    // 3. Fallback: print to console and bypass
    console.warn(`[Mailer] Nenhuma configuração de servidor de E-mail fornecida (SMTP ou MAILERSEND_API_TOKEN). Bypass ativado. O Código gerado foi: ${code}`);
    return { success: false, reason: 'unconfigured' };

  } catch (err) {
    console.error('[Mailer] Erro sistêmico ao enviar email:', err);
    return { success: false, reason: 'error' };
  }
}

