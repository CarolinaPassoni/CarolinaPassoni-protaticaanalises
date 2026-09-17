import { AccountAccessStatus, User } from '../types.js';

/**
 * Função centralizada para determinar o status de acesso do usuário.
 * Retornos possíveis:
 * - 'admin'
 * - 'trial_active'
 * - 'trial_expired'
 * - 'paid_active'
 * - 'paid_expired'
 * - 'blocked'
 */
export function getAccountAccessStatus(user: Partial<User> | null | undefined): AccountAccessStatus {
  if (!user) {
    return 'trial_expired';
  }

  if (user.is_blocked) {
    return 'blocked';
  }

  if (user.role === 'admin') {
    return 'admin';
  }

  const now = new Date().getTime();

  // If user is explicitly paid or converted
  if (user.account_type === 'paid') {
    if (user.subscription_expires_at) {
      const expTime = new Date(user.subscription_expires_at).getTime();
      if (now <= expTime) {
        return 'paid_active';
      } else {
        return 'paid_expired';
      }
    }
    if (user.subscription_status === 'active') {
      return 'paid_active';
    }
    return 'paid_expired';
  }

  // If user is in trial mode
  if (user.account_type === 'trial' || user.trial_status === 'active' || user.trial_status === 'expired' || user.trial_status === 'pending_verification') {
    if (user.trial_status === 'pending_verification') {
      return 'trial_expired'; // Not yet activated via email confirmation
    }

    if (user.trial_expires_at) {
      const trialExpTime = new Date(user.trial_expires_at).getTime();
      if (now <= trialExpTime) {
        return 'trial_active';
      } else {
        return 'trial_expired';
      }
    }

    if (user.trial_status === 'active') {
      return 'trial_active';
    }

    return 'trial_expired';
  }

  // Fallback for default users: if active subscription or created as paid
  if (user.subscription_expires_at) {
    const expTime = new Date(user.subscription_expires_at).getTime();
    if (now <= expTime) {
      return 'paid_active';
    }
    return 'paid_expired';
  }

  return 'paid_active';
}

/**
 * Retorna se o status permite uso de recursos premium da plataforma
 */
export function canAccessPremiumFeatures(statusOrUser: AccountAccessStatus | Partial<User> | null | undefined): boolean {
  if (!statusOrUser) return false;
  if (typeof statusOrUser === 'string') {
    return statusOrUser === 'admin' || statusOrUser === 'paid_active' || statusOrUser === 'trial_active';
  }
  const status = getAccountAccessStatus(statusOrUser);
  return status === 'admin' || status === 'paid_active' || status === 'trial_active';
}

/**
 * Formata o tempo restante do trial de forma amigável (string direta)
 */
export function formatRemainingTrialTime(expiresAtStr?: string | null): string {
  const details = getTrialRemainingDetails(expiresAtStr);
  return details.formattedText;
}

/**
 * Formata o tempo restante do trial de forma amigável
 */
export function getTrialRemainingDetails(expiresAtStr?: string | null): {
  isExpired: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  formattedText: string;
  badgeColor: 'emerald' | 'amber' | 'rose';
} {
  if (!expiresAtStr) {
    return {
      isExpired: true,
      daysRemaining: 0,
      hoursRemaining: 0,
      formattedText: 'Período encerrado',
      badgeColor: 'rose',
    };
  }

  const now = new Date();
  const expDate = new Date(expiresAtStr);
  const diffMs = expDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      isExpired: true,
      daysRemaining: 0,
      hoursRemaining: 0,
      formattedText: 'Período gratuito encerrado',
      badgeColor: 'rose',
    };
  }

  const diffHoursTotal = diffMs / (1000 * 60 * 60);
  const days = Math.floor(diffHoursTotal / 24);
  const hours = Math.floor(diffHoursTotal % 24);

  const expHours = String(expDate.getHours()).padStart(2, '0');
  const expMinutes = String(expDate.getMinutes()).padStart(2, '0');
  const expTimeStr = `${expHours}:${expMinutes}`;

  let formattedText = '';
  let badgeColor: 'emerald' | 'amber' | 'rose' = 'emerald';

  if (days >= 4) {
    formattedText = `Teste gratuito — faltam ${days} dias`;
    badgeColor = 'emerald';
  } else if (days >= 2) {
    formattedText = `faltam ${days} dias`;
    badgeColor = 'amber';
  } else if (days === 1) {
    formattedText = 'expira amanhã';
    badgeColor = 'amber';
  } else {
    formattedText = `expira hoje às ${expTimeStr}`;
    badgeColor = 'rose';
  }

  return {
    isExpired: false,
    daysRemaining: days,
    hoursRemaining: hours,
    formattedText,
    badgeColor,
  };
}
