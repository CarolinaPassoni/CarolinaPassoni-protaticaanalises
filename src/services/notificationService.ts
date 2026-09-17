import { db } from '../db-sqlite.js';
import {
  sendTrialReminder3Days,
  sendTrialReminder1Day,
  sendTrialExpiredEmail,
} from './emailService.js';
import { sendTelegramMessage } from './telegramService.js';

export async function notifyTrialRequested(userOrOptions: any) {
  try {
    const name = userOrOptions.name || 'Usuário';
    const email = userOrOptions.email || userOrOptions.to || '';
    const profile = userOrOptions.usageProfile || userOrOptions.profile || 'Treinador / Analista';
    const phone = userOrOptions.phone ? `\n📱 *WhatsApp:* ${userOrOptions.phone}` : '';
    const org = userOrOptions.organization ? `\n🏢 *Clube/Org:* ${userOrOptions.organization}` : '';
    const text = `🎁 *NOVO TESTE DE 7 DIAS SOLICITADO*\n\n👤 *Nome:* ${name}\n📧 *E-mail:* ${email}${phone}${org}\n🎯 *Perfil:* ${profile}\n⏱ *Status:* Aguardando confirmação de e-mail`;
    await sendTelegramMessage(text);
  } catch (e) {
    console.warn('[Notification] Failed to send Telegram alert for trial requested:', e);
  }
}

export async function notifyTrialActivated(userOrOptions: any, exp?: string) {
  try {
    const name = userOrOptions.name || 'Usuário';
    const email = userOrOptions.email || '';
    const expiresAt = exp || userOrOptions.trial_expires_at || userOrOptions.expiresAt || 'Em 7 dias';
    const text = `✅ *TESTE GRÁTIS ATIVADO (7 DIAS)*\n\n👤 *Nome:* ${name}\n📧 *E-mail:* ${email}\n📅 *Expiração:* ${expiresAt}`;
    await sendTelegramMessage(text);
  } catch (e) {
    console.warn('[Notification] Failed to send Telegram alert for trial activated:', e);
  }
}

export async function notifySubscriptionPaid(userOrOptions: any, planNameOrOptions?: any, amountFormatted?: any) {
  try {
    const name = userOrOptions.name || (userOrOptions.displayName) || 'Cliente';
    const email = userOrOptions.email || '';
    const plan = typeof planNameOrOptions === 'string' ? planNameOrOptions : (userOrOptions.planName || 'Plano ProTática');
    const amount = typeof amountFormatted === 'string' ? amountFormatted : (userOrOptions.amount ? `R$ ${userOrOptions.amount}` : '');
    const text = `💰 *NOVA ASSINATURA PAGA CONFIRMADA!*\n\n👤 *Cliente:* ${name}\n📧 *E-mail:* ${email}\n📦 *Plano:* ${plan}${amount ? `\n💳 *Valor:* ${amount}` : ''}\n🎉 Acesso liberado no sistema!`;
    await sendTelegramMessage(text);
  } catch (e) {
    console.warn('[Notification] Failed to send Telegram alert for subscription paid:', e);
  }
}

export async function notifyTrialExpiringSoon(userOrOptions: any, daysLeft?: number) {
  try {
    const name = userOrOptions.name || 'Usuário';
    const email = userOrOptions.email || '';
    const expiresAt = userOrOptions.trial_expires_at || userOrOptions.expiresAt || '';
    const days = daysLeft !== undefined ? daysLeft : (userOrOptions.daysLeft || 1);
    const text = `⏳ *TESTE EXPIRANDO EM ${days} DIAS*\n\n👤 *Usuário:* ${name}\n📧 *E-mail:* ${email}\n📅 *Expira:* ${expiresAt}`;
    await sendTelegramMessage(text);
  } catch (e) {
    console.warn('[Notification] Failed to send Telegram alert for trial expiring soon:', e);
  }
}

export async function processTrialNotifications(baseUrl: string): Promise<{
  reminders3Days: number;
  reminders1Day: number;
  expiredAlerts: number;
}> {
  let reminders3Days = 0;
  let reminders1Day = 0;
  let expiredAlerts = 0;

  try {
    const activeTrials: any[] = db.prepare(`
      SELECT id, username, email, display_name, trial_expires_at, trial_status
      FROM users
      WHERE account_type = 'trial'
        AND trial_expires_at IS NOT NULL
        AND email_verified = 1
        AND is_blocked = 0
    `).all();

    const now = new Date().getTime();

    for (const user of activeTrials) {
      const expDate = new Date(user.trial_expires_at);
      const expTime = expDate.getTime();
      const diffHours = (expTime - now) / (1000 * 60 * 60);

      const expFormatted = `${String(expDate.getDate()).padStart(2, '0')}/${String(expDate.getMonth() + 1).padStart(2, '0')}/${expDate.getFullYear()} às ${String(expDate.getHours()).padStart(2, '0')}:${String(expDate.getMinutes()).padStart(2, '0')}`;
      const userInfo = { id: user.id, name: user.display_name || user.username, email: user.email };

      // Phase 1: 3 days remaining (between 48h and 72h)
      if (diffHours > 48 && diffHours <= 72) {
        const alreadySent: any = db.prepare(`
          SELECT id FROM email_logs WHERE user_id = ? AND type = 'reminder_3_days' AND status IN ('sent', 'simulated_success')
        `).get(user.id);

        if (!alreadySent) {
          const res = await sendTrialReminder3Days(userInfo, expFormatted, baseUrl);
          if (res.success) {
            reminders3Days++;
            db.prepare(`
              INSERT INTO subscription_events (user_id, event_type, details_json, created_at)
              VALUES (?, 'reminder_sent', json_object('type', 'reminder_3_days', 'expires_at', ?), datetime('now'))
            `).run(user.id, user.trial_expires_at);
          }
        }
      }

      // Phase 2: 1 day remaining (between 0h and 24h)
      if (diffHours > 0 && diffHours <= 24) {
        const alreadySent: any = db.prepare(`
          SELECT id FROM email_logs WHERE user_id = ? AND type = 'reminder_1_day' AND status IN ('sent', 'simulated_success')
        `).get(user.id);

        if (!alreadySent) {
          const res = await sendTrialReminder1Day(userInfo, expFormatted, baseUrl);
          if (res.success) {
            reminders1Day++;
            db.prepare(`
              INSERT INTO subscription_events (user_id, event_type, details_json, created_at)
              VALUES (?, 'reminder_sent', json_object('type', 'reminder_1_day', 'expires_at', ?), datetime('now'))
            `).run(user.id, user.trial_expires_at);
          }
        }
      }

      // Phase 3: Expired (diffHours <= 0)
      if (diffHours <= 0) {
        // Mark trial_status = 'expired' if still active
        if (user.trial_status !== 'expired') {
          db.prepare(`UPDATE users SET trial_status = 'expired', updated_at = datetime('now') WHERE id = ?`).run(user.id);
        }

        const alreadySent: any = db.prepare(`
          SELECT id FROM email_logs WHERE user_id = ? AND type = 'trial_expired' AND status IN ('sent', 'simulated_success')
        `).get(user.id);

        if (!alreadySent) {
          const res = await sendTrialExpiredEmail(userInfo, baseUrl);
          if (res.success) {
            expiredAlerts++;
            db.prepare(`
              INSERT INTO subscription_events (user_id, event_type, details_json, created_at)
              VALUES (?, 'trial_expired', json_object('expires_at', ?), datetime('now'))
            `).run(user.id, user.trial_expires_at);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in processTrialNotifications:', err);
  }

  return { reminders3Days, reminders1Day, expiredAlerts };
}
