import nodemailer from 'nodemailer';
import { db, getSetting } from '../db-sqlite.js';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  type: string;
  userId?: string;
}

export function getSmtpConfig() {
  const production = process.env.NODE_ENV === 'production';
  const host = process.env.SMTP_HOST || (!production ? getSetting('smtp_host') || '' : '') || 'smtp.gmail.com';
  const user = process.env.SMTP_USER || (!production ? getSetting('smtp_user') || '' : '');
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || (!production ? getSetting('smtp_pass') || '' : '');
  const port = parseInt(process.env.SMTP_PORT || (!production ? getSetting('smtp_port') || '' : '') || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || (!production && getSetting('smtp_secure') === 'true') || port === 465;
  const fromName = process.env.SMTP_FROM_NAME || (!production ? getSetting('smtp_from_name') || '' : '') || 'PROTÁTICA';
  const fromEmail = process.env.SMTP_FROM_EMAIL || user || 'contato@protatica.com';

  return { host, user, pass, port, secure, fromName, fromEmail };
}

export function logSmtpConfigSafe() {
  const cfg = getSmtpConfig();
  console.log(`[SMTP] host=${cfg.host}`);
  console.log(`[SMTP] port=${cfg.port}`);
  console.log(`[SMTP] secure=${cfg.secure}`);
  console.log(`[SMTP] userConfigured=${Boolean(cfg.user)}`);
  console.log(`[SMTP] passwordConfigured=${Boolean(cfg.pass)}`);
  console.log(`[SMTP] fromEmail=${cfg.fromEmail}`);
}

export function getEmailTransporter(): nodemailer.Transporter | null {
  const cfg = getSmtpConfig();

  if (!cfg.host || !cfg.user || !cfg.pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    tls: {
      rejectUnauthorized: process.env.SMTP_ALLOW_INSECURE_TLS !== 'true',
    },
  });
}

export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  logSmtpConfigSafe();
  const mailer = getEmailTransporter();
  if (!mailer) {
    console.warn('[SMTP] Transporter não configurado (faltam credenciais de host/user/pass)');
    return { ok: false, error: 'Credenciais SMTP incompletas.' };
  }

  try {
    await mailer.verify();
    console.log('[SMTP] connection verified');
    return { ok: true };
  } catch (err: any) {
    console.error('[SMTP ERROR]', err.message || err);
    return { ok: false, error: err.message || 'Falha ao verificar conexão SMTP.' };
  }
}

export function logEmail(userId: string | undefined, email: string, type: string, status: string, providerMsgId?: string, errorSummary?: string) {
  try {
    db.prepare(`
      INSERT INTO email_logs (user_id, email, type, status, provider_message_id, error_summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(userId || null, email, type, status, providerMsgId || null, errorSummary || null);
  } catch (err) {
    console.error('[Email Logger] Failed to insert email log:', err);
  }
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cfg = getSmtpConfig();
  const from = `"${cfg.fromName}" <${cfg.fromEmail}>`;

  const mailer = getEmailTransporter();

  if (!mailer) {
    console.log(`\n================== [EMAIL SIMULADO (SMTP NÃO CONFIGURADO)] ==================`);
    console.log(`Para: ${options.to}`);
    console.log(`Tipo: ${options.type}`);
    console.log(`Assunto: ${options.subject}`);
    console.log(`Texto:\n${options.text || 'Veja versão HTML'}`);
    console.log(`===============================================================================\n`);

    logEmail(options.userId, options.to, options.type, 'simulated_success', 'mock-' + Date.now());
    return { success: true, messageId: 'mock-' + Date.now() };
  }

  try {
    const info = await mailer.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text || options.subject,
      html: options.html,
    });

    logEmail(options.userId, options.to, options.type, 'sent', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    console.error(`[Email Error] Failed to send ${options.type} to ${options.to}:`, errorMsg);
    logEmail(options.userId, options.to, options.type, 'error', undefined, errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ==================== TEMPLATES ====================

const baseEmailLayout = (title: string, content: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b1320; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 20px; }
    .card { background-color: #111d2e; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: 800; color: #10b981; letter-spacing: -0.5px; }
    .logo span { color: #f8fafc; }
    .badge { display: inline-block; background-color: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; margin-top: 8px; }
    .title { font-size: 20px; font-weight: 700; color: #f8fafc; margin-top: 16px; margin-bottom: 12px; }
    .text { font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 18px; }
    .box { background-color: #0b1320; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .box-item { font-size: 14px; margin-bottom: 6px; color: #cbd5e1; }
    .box-item strong { color: #10b981; }
    .btn { display: inline-block; background-color: #10b981; color: #022c22 !important; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 8px; text-align: center; margin: 16px 0; }
    .btn:hover { background-color: #34d399; }
    .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 24px; line-height: 1.5; }
    .feature-list { list-style: none; padding: 0; margin: 16px 0; }
    .feature-list li { font-size: 14px; color: #cbd5e1; margin-bottom: 8px; display: flex; align-items: center; }
    .feature-list li::before { content: "✓"; color: #10b981; font-weight: bold; margin-right: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">PRO<span>TÁTICA</span></div>
        <div class="badge">SCOUT & ANÁLISE TÁTICA PROFISSIONAL</div>
      </div>
      ${content}
      <div class="footer">
        <p>ProTática Inteligência Tática • Todos os direitos reservados</p>
        <p>Este é um e-mail automático do sistema. Se você não solicitou este acesso, ignore esta mensagem.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

export function resolveAppUrl(requestedUrl?: string): string {
  const envUrl = process.env.APP_PUBLIC_URL || process.env.APP_URL;
  const chosen = (envUrl && envUrl.trim() !== '') ? envUrl.trim() : (requestedUrl && requestedUrl.trim() !== '' ? requestedUrl.trim() : 'http://localhost:3000');
  return chosen.replace(/\/+$/, '');
}

export async function sendTrialVerificationEmail(
  userOrOptions: { id?: string; name?: string; email?: string; to?: string; verificationToken?: string; appUrl?: string; userId?: string } | { id: string; name: string; email: string },
  token?: string,
  baseUrl?: string
) {
  let user = {
    id: (userOrOptions as any).userId || (userOrOptions as any).id || '',
    name: (userOrOptions as any).name || 'Usuário',
    email: (userOrOptions as any).to || (userOrOptions as any).email || '',
  };
  const rawToken = token || (userOrOptions as any).verificationToken || '';
  const cleanBaseUrl = resolveAppUrl(baseUrl || (userOrOptions as any).appUrl);

  const verifyLink = `${cleanBaseUrl}/?verify_trial=${rawToken}`;
  const html = baseEmailLayout(
    'Confirme seu e-mail - ProTática',
    `
      <div class="title">Olá, ${user.name}!</div>
      <p class="text">Falta apenas um clique para você ativar seus <strong>7 dias de acesso gratuito e completo</strong> à plataforma ProTática.</p>
      
      <div style="text-align: center; margin: 28px 0;">
        <a href="${verifyLink}" class="btn">ATIVAR TESTE GRATUITO</a>
      </div>

      <p class="text" style="font-size: 13px; color: #64748b;">
        Ou copie e cole o link no seu navegador:<br/>
        <a href="${verifyLink}" style="color: #10b981; word-break: break-all;">${verifyLink}</a>
      </p>

      <div class="box">
        <div class="box-item">⏱ <strong>Validade do link:</strong> 24 horas</div>
        <div class="box-item">🔒 <strong>Segurança:</strong> Seus 7 dias começam a contar apenas após a ativação.</div>
      </div>
    `
  );

  return sendEmail({
    to: user.email,
    subject: 'Confirme seu e-mail para ativar seus 7 dias grátis no ProTática',
    text: `Olá ${user.name}, confirme seu e-mail para ativar seu teste de 7 dias no ProTática: ${verifyLink}`,
    html,
    type: 'trial_verification',
    userId: user.id,
  });
}

export async function sendTrialWelcomeEmail(
  userOrOptions: any,
  expiresAtFormatted?: string,
  setPasswordToken?: string,
  baseUrl?: string
) {
  const user = {
    id: userOrOptions.userId || userOrOptions.id || '',
    name: userOrOptions.name || 'Usuário',
    email: userOrOptions.to || userOrOptions.email || '',
  };
  const expFormatted = expiresAtFormatted || userOrOptions.expiresAtFormatted || '7 dias';
  const token = setPasswordToken || userOrOptions.setPasswordToken || userOrOptions.token || '';
  const url = resolveAppUrl(baseUrl || userOrOptions.baseUrl || userOrOptions.appUrl);

  const setPasswordLink = `${url}/?set_password=${token}`;
  const html = baseEmailLayout(
    'Acesso Liberado - ProTática',
    `
      <div class="title">Seu acesso de 7 dias está liberado! ⚽</div>
      <p class="text">Olá, <strong>${user.name}</strong>! Seu período gratuito de 7 dias foi ativado com sucesso.</p>
      
      <div class="box">
        <div class="box-item">👤 <strong>Usuário / E-mail:</strong> ${user.email}</div>
        <div class="box-item">📅 <strong>Validade do Demo:</strong> Até ${expFormatted}</div>
        <div class="box-item">⚡ <strong>Status:</strong> 7 dias liberados (sem cartão de crédito)</div>
      </div>

      <p class="text">Para começar com total segurança, clique no botão abaixo para definir sua senha pessoal de acesso:</p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${setPasswordLink}" class="btn">CRIAR SENHA E ACESSAR</a>
      </div>

      <p class="text"><strong>Principais funcionalidades liberadas no seu teste:</strong></p>
      <ul class="feature-list">
        <li>Análise Tática Automatizada via IA por vídeo (URL do YouTube ou upload de arquivo)</li>
        <li>Mapas de calor de posicionamento e zonas de pressão</li>
        <li>Gráficos de posse, finalizações e radar tático comparativo</li>
        <li>Exportação de relatórios executivos em PDF de alta resolução</li>
        <li>Canal e integração com Telegram para avisos e envio</li>
      </ul>

      <p class="text" style="font-size: 13px; color: #64748b;">
        Endereço oficial: <a href="${url}" style="color: #10b981;">${url}</a>
      </p>
    `
  );

  return sendEmail({
    to: user.email,
    subject: 'Seu acesso de 7 dias ao ProTática está liberado',
    text: `Olá ${user.name}! Seu acesso de 7 dias está liberado até ${expFormatted}. Crie sua senha de acesso em: ${setPasswordLink}`,
    html,
    type: 'trial_welcome',
    userId: user.id,
  });
}

export async function sendTrialReminder3Days(user: { id: string; name: string; email: string }, expiresAtFormatted: string, baseUrl: string) {
  const html = baseEmailLayout(
    'Lembrete ProTática - Faltam 3 dias',
    `
      <div class="title">Faltam 3 dias para o fim do seu teste grátis</div>
      <p class="text">Olá, <strong>${user.name}</strong>! Esperamos que esteja aproveitando ao máximo as análises táticas da plataforma.</p>
      
      <div class="box">
        <div class="box-item">⏳ <strong>Término do período gratuito:</strong> ${expiresAtFormatted}</div>
      </div>

      <p class="text">Para continuar utilizando sem interrupções e manter todo o seu histórico de análises salvo, conheça nossos planos oficiais.</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/#planos" class="btn">CONHECER PLANOS</a>
      </div>
    `
  );

  return sendEmail({
    to: user.email,
    subject: 'Seu teste grátis do ProTática termina em 3 dias.',
    text: `Olá ${user.name}, seu teste gratuito termina em 3 dias (${expiresAtFormatted}). Acesse ${baseUrl} para garantir seu plano.`,
    html,
    type: 'reminder_3_days',
    userId: user.id,
  });
}

export async function sendTrialReminder1Day(user: { id: string; name: string; email: string }, expiresAtFormatted: string, baseUrl: string) {
  const html = baseEmailLayout(
    'Atenção ProTática - Expira amanhã',
    `
      <div class="title">Seu acesso gratuito termina amanhã! ⏰</div>
      <p class="text">Olá, <strong>${user.name}</strong>! Seu período de demonstração de 7 dias está quase no fim.</p>
      
      <div class="box">
        <div class="box-item">⚠️ <strong>Expiração:</strong> ${expiresAtFormatted}</div>
      </div>

      <p class="text">Não perca o acesso às ferramentas de scout, comparativo e exportação em PDF. Faça o upgrade agora mesmo:</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/#planos" class="btn">ASSINAR PROTÁTICA</a>
      </div>
    `
  );

  return sendEmail({
    to: user.email,
    subject: 'Seu acesso gratuito termina amanhã.',
    text: `Olá ${user.name}, seu acesso gratuito termina amanhã (${expiresAtFormatted}). Acesse ${baseUrl} para escolher um plano.`,
    html,
    type: 'reminder_1_day',
    userId: user.id,
  });
}

export async function sendTrialExpiredEmail(user: { id: string; name: string; email: string }, baseUrl: string) {
  const html = baseEmailLayout(
    'Período gratuito encerrado - ProTática',
    `
      <div class="title">Seu período gratuito terminou</div>
      <p class="text">Olá, <strong>${user.name}</strong>. Os 7 dias de demonstração do ProTática foram finalizados.</p>
      <p class="text">Fique tranquilo: <strong>todos os seus relatórios e históricos de análises continuam preservados</strong> no seu perfil.</p>

      <p class="text">Escolha um dos planos para reativar seu acesso imediato com todas as ferramentas liberadas.</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/#planos" class="btn">ESCOLHER UM PLANO</a>
      </div>
    `
  );

  return sendEmail({
    to: user.email,
    subject: 'Seu período gratuito terminou. Escolha um plano para continuar utilizando o ProTática.',
    text: `Olá ${user.name}, seu período gratuito terminou. Escolha um plano para continuar: ${baseUrl}/#planos`,
    html,
    type: 'trial_expired',
    userId: user.id,
  });
}

export async function sendPaymentApprovedEmail(
  userOrOptions: any,
  planName?: string,
  amountFormatted?: string,
  expiresAtFormatted?: string,
  baseUrl?: string
) {
  const user = {
    id: userOrOptions.userId || userOrOptions.id || '',
    name: userOrOptions.name || 'Cliente',
    email: userOrOptions.to || userOrOptions.email || '',
  };
  const plan = planName || userOrOptions.planName || 'Plano ProTática';
  const amount = amountFormatted || userOrOptions.amountFormatted || (userOrOptions.amount ? `R$ ${userOrOptions.amount}` : 'Confirmado');
  const expiresAt = expiresAtFormatted || userOrOptions.expiresAtFormatted || userOrOptions.expiresAt || 'Vigência Ativa';
  const url = baseUrl || userOrOptions.baseUrl || userOrOptions.appUrl || 'http://localhost:3000';
  const passwordPlain = userOrOptions.passwordPlain || null;

  const credentialsBlock = passwordPlain
    ? `
      <div class="box" style="border-color: #10b981; background-color: #064e3b20;">
        <div class="box-item">🔑 <strong>Seus dados de acesso gerados com segurança:</strong></div>
        <div class="box-item">👤 <strong>Usuário / E-mail:</strong> ${user.email}</div>
        <div class="box-item">🔒 <strong>Senha Provisória:</strong> <code style="background:#0f172a; color:#fbbf24; padding: 2px 6px; border-radius:4px; font-weight:bold;">${passwordPlain}</code></div>
      </div>
      <p class="text" style="font-size:12px; color:#94a3b8;">Recomendamos alterar sua senha nas configurações do sistema após o primeiro acesso.</p>
    `
    : '';

  const html = baseEmailLayout(
    'Plano Ativado - ProTática',
    `
      <div class="title">Seu plano ProTática está ativo! 🎉</div>
      <p class="text">Olá, <strong>${user.name}</strong>! Recebemos a confirmação do seu pagamento e sua conta já está com acesso total liberado.</p>
      
      <div class="box">
        <div class="box-item">📦 <strong>Plano:</strong> ${plan}</div>
        <div class="box-item">💳 <strong>Valor:</strong> ${amount}</div>
        <div class="box-item">📅 <strong>Validade / Próxima Renovação:</strong> ${expiresAt}</div>
        <div class="box-item">✨ <strong>Status:</strong> Assinatura Ativa</div>
      </div>

      ${credentialsBlock}

      <div style="text-align: center; margin: 28px 0;">
        <a href="${url}" class="btn">ACESSAR PROTÁTICA</a>
      </div>

      <p class="text" style="font-size: 13px; color: #64748b;">
        Obrigado por escolher o ProTática para elevar o nível da sua análise tática!
      </p>
    `
  );

  return sendEmail({
    to: user.email,
    subject: 'Seu plano ProTática está ativo',
    text: `Olá ${user.name}! Seu plano ${plan} está ativo no ProTática até ${expiresAt}. Acesse: ${url}`,
    html,
    type: 'payment_approved',
    userId: user.id,
  });
}

export async function sendPaidAccessCredentialsEmail(
  userOrOptions: any,
  planName?: string,
  amountFormatted?: string,
  expiresAtFormatted?: string,
  baseUrl?: string
) {
  return sendPaymentApprovedEmail(userOrOptions, planName, amountFormatted, expiresAtFormatted, baseUrl);
}

export async function sendPaymentFailedEmail(user: { id: string; name: string; email: string }, baseUrl: string) {
  const html = baseEmailLayout(
    'Falha no Pagamento - ProTática',
    `
      <div class="title">Não foi possível confirmar seu pagamento</div>
      <p class="text">Olá, <strong>${user.name}</strong>. Houve uma falha no processamento do pagamento da sua assinatura.</p>
      <p class="text">Por favor, atualize a forma de pagamento ou tente novamente para que seu plano seja liberado normalmente.</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/#planos" class="btn">TENTAR NOVAMENTE</a>
      </div>
    `
  );

  return sendEmail({
    to: user.email,
    subject: 'Não foi possível confirmar seu pagamento.',
    text: `Olá ${user.name}, não foi possível confirmar seu pagamento no ProTática. Atualize a forma de pagamento em: ${baseUrl}/#planos`,
    html,
    type: 'payment_failed',
    userId: user.id,
  });
}

// Function Aliases for unified naming
export const sendTrialActivatedEmail = sendTrialWelcomeEmail;
export const sendTrialExpiringAlertEmail = sendTrialReminder1Day;

export async function sendPasswordResetEmail(
  user: { id?: string; name?: string; email?: string; to?: string; userId?: string },
  rawToken: string,
  baseUrl?: string
) {
  const name = user.name || 'Usuário';
  const email = user.to || user.email || '';
  const userId = user.userId || user.id;
  const cleanBaseUrl = resolveAppUrl(baseUrl);
  const resetLink = `${cleanBaseUrl}/reset-password?token=${rawToken}`;

  const html = baseEmailLayout(
    'Redefinição de senha - ProTática',
    `
      <div class="title">Olá, ${name}.</div>
      <p class="text">Recebemos uma solicitação para redefinir sua senha no ProTática.</p>
      
      <p class="text">Clique no botão abaixo para redefinir sua senha:</p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetLink}" class="btn">REDEFINIR MINHA SENHA</a>
      </div>

      <p class="text" style="font-size: 13px; color: #64748b;">
        Ou copie e cole o link direto no seu navegador:<br/>
        <a href="${resetLink}" style="color: #10b981; word-break: break-all;">${resetLink}</a>
      </p>

      <div class="box">
        <div class="box-item">⏱ <strong>Validade:</strong> Este link expira em 1 hora.</div>
        <div class="box-item">🔒 <strong>Segurança:</strong> Se você não solicitou a redefinição, ignore este e-mail.</div>
      </div>
    `
  );

  return sendEmail({
    to: email,
    subject: 'ProTática - Redefinição de senha',
    text: `Olá, ${name}.\n\nRecebemos uma solicitação para redefinir sua senha no ProTática.\n\nClique no link abaixo para criar sua nova senha:\n${resetLink}\n\nEste link expira em 1 hora.\nSe você não solicitou a redefinição, ignore este e-mail.`,
    html,
    type: 'password_reset',
    userId,
  });
}

