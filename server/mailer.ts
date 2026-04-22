const API_URL = 'https://api.mailersend.com/v1/email';
const API_TOKEN = process.env.MAILERSEND_API_TOKEN;
const FROM_DOMAIN = process.env.MAILERSEND_DOMAIN || 'test-eqvygm07v7zl0p7w.mlsender.net';

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

  const payload = {
    from: {
      email: `suporte@${FROM_DOMAIN}`,
      name: "InstaBoost PRO Segurança"
    },
    to: [
      {
        email: toEmail
      }
    ],
    subject: subject,
    text: text,
    html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px;">
        <h2 style="color: #333; margin-bottom: 20px;">InstaBoost PRO</h2>
        <p style="color: #555; line-height: 1.5; font-size: 16px;">${text.replace(/\n\n/g, '<br/><br/>').replace(code, `<strong><span style="font-size: 24px; letter-spacing: 4px; display: inline-block; padding: 10px 0; color: #000;">${code}</span></strong>`)}</p>
    </div>`
  };

  try {
    if (!API_TOKEN) {
      console.warn('[Mailer] MAILERSEND_API_TOKEN não está configurado. Simulando envio de email no console:', payload);
      return true;
    }

    // Dynamically importing node-fetch for environments that might not natively support it seamlessly
    // or just relying on global defaults
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
      console.error('[Mailer] Erro ao enviar email pela API:', response.status, respErr);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[Mailer] Erro sistêmico ao enviar email:', err);
    return false;
  }
}
