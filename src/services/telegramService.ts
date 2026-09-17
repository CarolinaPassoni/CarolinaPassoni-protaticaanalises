import { getSetting, setSetting, logTelegramMessage, listTelegramMessages, clearTelegramMessages, listAnalyses, getAnalysisById, listAllFullAnalyses } from '../db-sqlite.js';
import { generateAnalysisPdf, sanitizeFilename } from './pdfService.js';

export { listTelegramMessages, clearTelegramMessages };

export interface TelegramBotConfig {
  active: boolean;
  channelId: string;
  vipGroupId: string;
  autoPublish: boolean;
  autoSendReport: boolean;
  autoSendHeatmaps: boolean;
  sendAlerts: boolean;
  webhookSecret: string;
  hasToken: boolean;
  maskedToken?: string;
  botInfo?: {
    id?: number;
    username?: string;
    firstName?: string;
  } | null;
}

export interface TelegramSelectedContents {
  resumo?: boolean;
  estatisticas?: boolean;
  tatica?: boolean;
  mapaCalor?: boolean;
  scouting?: boolean;
  comparativo?: boolean;
  destaques?: boolean;
  pdf?: boolean;
}

export interface TelegramPublishOptions {
  target?: 'all' | 'channel' | 'vip';
  selectedContents?: TelegramSelectedContents;
  reportPdfBase64?: string;
  pdfFilename?: string;
  heatmapDataUrl?: string;
  customNote?: string;
  isAuto?: boolean;
  appUrl?: string;
  // Legacy backward compatibility
  sendReportPdf?: boolean;
  sendHeatmap?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function getTelegramToken(): string {
  const fromEnv = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (fromEnv) return fromEnv;
  // In production, secrets must come from environment/secret manager, not SQLite.
  if (process.env.NODE_ENV === 'production') return '';
  return (getSetting('telegram_bot_token') || '').trim();
}

export function getTelegramConfig(): TelegramBotConfig {
  const token = getTelegramToken();
  const activeSetting = getSetting('telegram_bot_active');
  const active = activeSetting !== null ? activeSetting === 'true' : Boolean(token);
  
  const channelId = getSetting('telegram_channel_id') || process.env.TELEGRAM_CHANNEL_ID || '';
  const vipGroupId = getSetting('telegram_vip_group_id') || process.env.TELEGRAM_VIP_GROUP_ID || '';
  const autoPublish = (getSetting('telegram_auto_publish') ?? 'false') === 'true';
  const autoSendReport = (getSetting('telegram_auto_send_report') ?? 'false') === 'true';
  const autoSendHeatmaps = (getSetting('telegram_auto_send_heatmaps') ?? 'false') === 'true';
  const sendAlerts = (getSetting('telegram_send_alerts') ?? 'false') === 'true';
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || (process.env.NODE_ENV !== 'production' ? getSetting('telegram_webhook_secret') || '' : '');

  let maskedToken = '';
  if (token) {
    const parts = token.split(':');
    if (parts.length === 2) {
      maskedToken = `${parts[0]}:${parts[1].slice(0, 4)}...${parts[1].slice(-4)}`;
    } else {
      maskedToken = `${token.slice(0, 4)}...${token.slice(-4)}`;
    }
  }

  let botInfo: TelegramBotConfig['botInfo'] = null;
  const botInfoJson = getSetting('telegram_bot_cached_info');
  if (botInfoJson) {
    try {
      botInfo = JSON.parse(botInfoJson);
    } catch {
      botInfo = null;
    }
  }

  return {
    active,
    hasToken: Boolean(token),
    maskedToken,
    channelId,
    vipGroupId,
    autoPublish,
    autoSendReport,
    autoSendHeatmaps,
    sendAlerts,
    webhookSecret,
    botInfo,
  };
}

export function saveTelegramConfig(config: Partial<{
  active: boolean;
  botToken: string;
  channelId: string;
  vipGroupId: string;
  autoPublish: boolean;
  autoSendReport: boolean;
  autoSendHeatmaps: boolean;
  sendAlerts: boolean;
  webhookSecret: string;
}>): void {
  if (config.active !== undefined) {
    setSetting('telegram_bot_active', config.active ? 'true' : 'false');
  }
  if (process.env.NODE_ENV !== 'production' && config.botToken !== undefined && config.botToken.trim() !== '') {
    setSetting('telegram_bot_token', config.botToken.trim());
  }
  if (config.channelId !== undefined) {
    setSetting('telegram_channel_id', config.channelId.trim());
  }
  if (config.vipGroupId !== undefined) {
    setSetting('telegram_vip_group_id', config.vipGroupId.trim());
  }
  if (config.autoPublish !== undefined) {
    setSetting('telegram_auto_publish', config.autoPublish ? 'true' : 'false');
  }
  if (config.autoSendReport !== undefined) {
    setSetting('telegram_auto_send_report', config.autoSendReport ? 'true' : 'false');
  }
  if (config.autoSendHeatmaps !== undefined) {
    setSetting('telegram_auto_send_heatmaps', config.autoSendHeatmaps ? 'true' : 'false');
  }
  if (config.sendAlerts !== undefined) {
    setSetting('telegram_send_alerts', config.sendAlerts ? 'true' : 'false');
  }
  if (process.env.NODE_ENV !== 'production' && config.webhookSecret !== undefined) {
    setSetting('telegram_webhook_secret', config.webhookSecret.trim());
  }
}

/**
 * Realiza teste de conexão via Telegram Bot API (getMe)
 */
export async function testTelegramConnection(customToken?: string): Promise<{
  ok: boolean;
  bot?: { id: number; username: string; firstName: string };
  error?: string;
}> {
  const token = (customToken || getTelegramToken()).trim();
  if (!token) {
    return { ok: false, error: 'Nenhum token do Telegram configurado.' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as any;

    if (data && data.ok && data.result) {
      const bot = {
        id: data.result.id,
        username: data.result.username || '',
        firstName: data.result.first_name || '',
      };
      setSetting('telegram_bot_cached_info', JSON.stringify(bot));
      return { ok: true, bot };
    } else {
      const errDescription = data?.description || 'Falha ao autenticar com o Telegram.';
      return { ok: false, error: errDescription };
    }
  } catch (err: any) {
    return { ok: false, error: `Erro de rede ao conectar à API do Telegram: ${err.message || err}` };
  }
}

/**
 * Envia mensagem de texto para o chat/canal/grupo especificado
 */
export async function sendMessage(
  chatId: string,
  text: string,
  options: {
    parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2';
    disable_web_page_preview?: boolean;
    reply_markup?: any;
    tipo?: string;
  } = {}
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const token = getTelegramToken();
  if (!token) {
    logTelegramMessage({
      chat_id: chatId,
      tipo: options.tipo || 'mensagem',
      conteudo_resumido: text.slice(0, 100),
      status: 'erro',
      erro: 'Token do Telegram não configurado',
    });
    return { ok: false, error: 'Token do Telegram não configurado' };
  }

  if (!chatId) {
    logTelegramMessage({
      chat_id: 'vazio',
      tipo: options.tipo || 'mensagem',
      conteudo_resumido: text.slice(0, 100),
      status: 'erro',
      erro: 'Chat ID de destino não especificado',
    });
    return { ok: false, error: 'Chat ID de destino não especificado' };
  }

  try {
    const body: Record<string, any> = {
      chat_id: chatId,
      text: text,
      parse_mode: options.parse_mode || 'HTML',
      disable_web_page_preview: options.disable_web_page_preview ?? false,
    };

    if (options.reply_markup) {
      body.reply_markup = options.reply_markup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as any;

    if (data && data.ok) {
      logTelegramMessage({
        chat_id: chatId,
        tipo: options.tipo || 'mensagem',
        conteudo_resumido: text.slice(0, 120),
        status: 'sucesso',
      });
      return { ok: true, messageId: data.result?.message_id };
    } else {
      const errMsg = data?.description || 'Erro desconhecido retornado pelo Telegram';
      logTelegramMessage({
        chat_id: chatId,
        tipo: options.tipo || 'mensagem',
        conteudo_resumido: text.slice(0, 120),
        status: 'erro',
        erro: errMsg,
      });
      return { ok: false, error: errMsg };
    }
  } catch (err: any) {
    const msg = err.message || String(err);
    logTelegramMessage({
      chat_id: chatId,
      tipo: options.tipo || 'mensagem',
      conteudo_resumido: text.slice(0, 120),
      status: 'erro',
      erro: msg,
    });
    return { ok: false, error: msg };
  }
}

/**
 * Envia mensagem automática do sistema para o canal/grupo padrão
 */
export async function sendTelegramMessage(text: string, customChatId?: string) {
  const config = getTelegramConfig();
  const target = customChatId || config.channelId || config.vipGroupId;
  if (!target) return { ok: false, error: 'Nenhum canal/grupo configurado' };
  return sendMessage(target, text, { parse_mode: 'Markdown', tipo: 'alerta_sistema' });
}

/**
 * Converte de forma resiliente qualquer payload (Data URI, Base64 bruto, Buffer ou Uint8Array) em Buffer Node.js válido.
 */
export function parsePayloadToBuffer(input: string | Buffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input === 'string') {
    let clean = input.trim();
    if (clean.includes(';base64,')) {
      clean = clean.split(';base64,')[1];
    } else if (clean.startsWith('data:')) {
      const idx = clean.indexOf(',');
      if (idx !== -1) clean = clean.slice(idx + 1);
    }
    clean = clean.replace(/[\r\n\t\s]+/g, '');
    return Buffer.from(clean, 'base64');
  }
  return Buffer.from(input as any);
}

/**
 * Envia uma foto para o chat/canal/grupo
 */
export async function sendPhoto(
  chatId: string,
  photo: string | Buffer | Uint8Array,
  caption?: string,
  options: { parse_mode?: 'Markdown' | 'HTML'; reply_markup?: any; tipo?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
  const token = getTelegramToken();
  if (!token) return { ok: false, error: 'Token do Telegram não configurado' };

  try {
    // Se foto for URL remota (http/https)
    if (typeof photo === 'string' && (photo.startsWith('http://') || photo.startsWith('https://'))) {
      const body: Record<string, any> = {
        chat_id: chatId,
        photo: photo,
        caption: caption || '',
        parse_mode: options.parse_mode || 'HTML',
      };
      if (options.reply_markup) {
        body.reply_markup = options.reply_markup;
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as any;
      if (data && data.ok) {
        logTelegramMessage({
          chat_id: chatId,
          tipo: options.tipo || 'foto_url',
          conteudo_resumido: caption ? caption.slice(0, 100) : 'Envio de foto remota',
          status: 'sucesso',
        });
        return { ok: true };
      } else {
        const err = data?.description || 'Erro ao enviar foto remota';
        logTelegramMessage({
          chat_id: chatId,
          tipo: options.tipo || 'foto_url',
          conteudo_resumido: caption ? caption.slice(0, 100) : 'Envio de foto remota',
          status: 'erro',
          erro: err,
        });
        return { ok: false, error: err };
      }
    }

    // Se foto for Base64 Data URL ou Buffer
    let buffer: Buffer;
    let mimeType = 'image/png';
    let filename = 'heatmap.png';

    if (typeof photo === 'string') {
      let clean = photo.trim();
      if (clean.includes(';base64,')) {
        clean = clean.split(';base64,')[1];
      } else if (clean.startsWith('data:')) {
        const idx = clean.indexOf(',');
        if (idx !== -1) clean = clean.slice(idx + 1);
      }
      clean = clean.replace(/[\r\n\t\s]+/g, '');
      buffer = Buffer.from(clean, 'base64');

      if (photo.includes('image/jpeg') || photo.includes('image/jpg')) {
        mimeType = 'image/jpeg';
        filename = 'heatmap.jpg';
      }
    } else if (Buffer.isBuffer(photo)) {
      buffer = photo;
    } else {
      buffer = Buffer.from(photo);
    }

    const formData = new FormData();
    formData.append('chat_id', chatId);
    if (caption) formData.append('caption', caption);
    if (options.parse_mode) formData.append('parse_mode', options.parse_mode);
    if (options.reply_markup) formData.append('reply_markup', JSON.stringify(options.reply_markup));

    const blob = new Blob([buffer], { type: mimeType });
    formData.append('photo', blob, filename);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });

    const data = (await res.json()) as any;
    if (data && data.ok) {
      logTelegramMessage({
        chat_id: chatId,
        tipo: options.tipo || 'mapa_calor',
        conteudo_resumido: caption ? caption.slice(0, 100) : 'Envio de imagem/mapa de calor',
        status: 'sucesso',
      });
      return { ok: true };
    } else {
      const err = data?.description || 'Erro no envio da foto';
      logTelegramMessage({
        chat_id: chatId,
        tipo: options.tipo || 'mapa_calor',
        conteudo_resumido: caption ? caption.slice(0, 100) : 'Envio de imagem/mapa de calor',
        status: 'erro',
        erro: err,
      });
      return { ok: false, error: err };
    }
  } catch (err: any) {
    const msg = err.message || String(err);
    logTelegramMessage({
      chat_id: chatId,
      tipo: options.tipo || 'mapa_calor',
      conteudo_resumido: caption ? caption.slice(0, 100) : 'Envio de imagem',
      status: 'erro',
      erro: msg,
    });
    return { ok: false, error: msg };
  }
}

/**
 * Envia um documento PDF para o chat/canal/grupo
 */
export async function sendDocument(
  chatId: string,
  document: Buffer | string | Uint8Array,
  filename = 'relatorio-protatica.pdf',
  caption?: string,
  options: { parse_mode?: 'Markdown' | 'HTML'; reply_markup?: any; tipo?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
  const token = getTelegramToken();
  if (!token) return { ok: false, error: 'Token do Telegram não configurado' };

  try {
    let buffer: Buffer;
    if (typeof document === 'string') {
      let clean = document.trim();
      if (clean.includes(';base64,')) {
        clean = clean.split(';base64,')[1];
      } else if (clean.startsWith('data:')) {
        const idx = clean.indexOf(',');
        if (idx !== -1) clean = clean.slice(idx + 1);
      }
      clean = clean.replace(/[\r\n\t\s]+/g, '');
      buffer = Buffer.from(clean, 'base64');
    } else if (Buffer.isBuffer(document)) {
      buffer = document;
    } else {
      buffer = Buffer.from(document);
    }

    if (!buffer || buffer.length === 0) {
      console.error('[TELEGRAM PDF ERROR] Buffer de PDF vazio');
      return { ok: false, error: 'PDF_EMPTY: O arquivo PDF para envio está vazio.' };
    }

    console.log('[TELEGRAM] sendDocument started');
    console.log('[TELEGRAM] document size:', buffer.length, 'bytes');

    const cleanFilename = sanitizeFilename(filename);
    const formData = new FormData();
    formData.append('chat_id', chatId);
    if (caption) formData.append('caption', caption);
    if (options.parse_mode) formData.append('parse_mode', options.parse_mode);
    if (options.reply_markup) formData.append('reply_markup', JSON.stringify(options.reply_markup));

    const blob = new Blob([buffer], { type: 'application/pdf' });
    formData.append('document', blob, cleanFilename);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const data = (await res.json()) as any;
    if (res.ok && data && data.ok) {
      console.log('[TELEGRAM] sendDocument success');
      logTelegramMessage({
        chat_id: chatId,
        tipo: options.tipo || 'relatorio_pdf',
        conteudo_resumido: `PDF: ${cleanFilename} (${buffer.length} bytes)`,
        status: 'sucesso',
      });
      return { ok: true };
    } else {
      const err = data?.description || `HTTP ${res.status}: Erro ao enviar documento PDF`;
      console.error('[TELEGRAM PDF ERROR]', data?.error_code, data?.description);
      logTelegramMessage({
        chat_id: chatId,
        tipo: options.tipo || 'relatorio_pdf',
        conteudo_resumido: `PDF: ${cleanFilename}`,
        status: 'erro',
        erro: err,
      });
      return { ok: false, error: err };
    }
  } catch (err: any) {
    const msg = err.message || String(err);
    console.error('[TELEGRAM PDF ERROR] Exceção:', msg);
    logTelegramMessage({
      chat_id: chatId,
      tipo: options.tipo || 'relatorio_pdf',
      conteudo_resumido: `PDF: ${filename}`,
      status: 'erro',
      erro: msg,
    });
    return { ok: false, error: msg };
  }
}

// -------------------------------------------------------------
// FORMATADORES OFICIAIS PROTÁTICA PARA CADA TIPO DE CONTEÚDO
// -------------------------------------------------------------

/**
 * 1. RESUMO DA PARTIDA
 */
export function formatMatchSummary(analysis: any): string {
  const timeA = (analysis.timeA || 'Time A').trim();
  const timeB = (analysis.timeB || 'Time B').trim();
  const placar = analysis.placar && analysis.placar !== 'não identificado' ? analysis.placar : null;

  let msg = `⚽ <b>PROTÁTICA | ANÁLISE DA PARTIDA</b>\n\n`;

  const ctx = analysis.contextoPartida || {};
  if (ctx.competicao && ctx.competicao !== 'Não identificada') {
    msg += `🏆 <b>Competição:</b> ${ctx.competicao}\n`;
  }
  if (ctx.dataJogo && ctx.dataJogo !== 'Não identificada') {
    msg += `📅 <b>Data:</b> ${ctx.dataJogo}\n`;
  }
  if (ctx.estadio && ctx.estadio !== 'Não identificado') {
    msg += `🏟 <b>Estádio:</b> ${ctx.estadio}${ctx.cidade && ctx.cidade !== 'Não identificada' ? ` (${ctx.cidade})` : ''}\n`;
  }

  msg += `⚽ <b>${timeA} x ${timeB}</b>\n`;
  if (placar) {
    msg += `🔢 <b>Placar:</b> ${placar}\n`;
  }

  if (analysis.resumoPartida) {
    msg += `\n📝 <b>Resumo:</b>\n${analysis.resumoPartida}\n`;
  }

  return msg.trim();
}

/**
 * 2. ESTATÍSTICAS COMPLETAS DA PARTIDA
 * Regra: Não enviar métricas inexistentes como zero. Se o dado não existir, omitir a linha.
 */
export function formatMatchStatistics(analysis: any): string | null {
  const timeA = (analysis.timeA || 'Time A').trim();
  const timeB = (analysis.timeB || 'Time B').trim();
  const est = analysis.estatisticas || {};
  const adv = analysis.indicadoresAvancados || {};

  const lines: string[] = [];
  const isValid = (v?: string) => v && v.trim() !== '' && v !== '—' && v !== 'N/D' && v !== 'nd';

  if (isValid(est.posseDeBola?.timeA) || isValid(est.posseDeBola?.timeB)) {
    lines.push(`⚽ <b>Posse de bola:</b> ${est.posseDeBola?.timeA || '—'} x ${est.posseDeBola?.timeB || '—'}`);
  }
  if (isValid(est.finalizacoes?.timeA) || isValid(est.finalizacoes?.timeB)) {
    lines.push(`🎯 <b>Finalizações:</b> ${est.finalizacoes?.timeA || '—'} x ${est.finalizacoes?.timeB || '—'}`);
  }
  if (isValid(est.finalizacoesNoAlvo?.timeA) || isValid(est.finalizacoesNoAlvo?.timeB)) {
    lines.push(`🥅 <b>Finalizações no gol:</b> ${est.finalizacoesNoAlvo?.timeA || '—'} x ${est.finalizacoesNoAlvo?.timeB || '—'}`);
  }
  if (isValid(adv.xG?.timeA) || isValid(adv.xG?.timeB)) {
    lines.push(`📈 <b>xG:</b> ${adv.xG?.timeA || '—'} x ${adv.xG?.timeB || '—'}`);
  }
  if (isValid(adv.grandesChances?.timeA) || isValid(adv.grandesChances?.timeB)) {
    lines.push(`🔥 <b>Grandes chances:</b> ${adv.grandesChances?.timeA || '—'} x ${adv.grandesChances?.timeB || '—'}`);
  }
  if (isValid(est.passesCertos?.timeA) || isValid(est.passesCertos?.timeB)) {
    lines.push(`✅ <b>Passes certos:</b> ${est.passesCertos?.timeA || '—'} x ${est.passesCertos?.timeB || '—'}`);
  }
  if (isValid(est.desarmes?.timeA) || isValid(est.desarmes?.timeB)) {
    lines.push(`🛡 <b>Desarmes:</b> ${est.desarmes?.timeA || '—'} x ${est.desarmes?.timeB || '—'}`);
  }
  if (isValid(est.escanteios?.timeA) || isValid(est.escanteios?.timeB)) {
    lines.push(`🚩 <b>Escanteios:</b> ${est.escanteios?.timeA || '—'} x ${est.escanteios?.timeB || '—'}`);
  }
  if (isValid(est.faltasCometidas?.timeA) || isValid(est.faltasCometidas?.timeB)) {
    lines.push(`⚠️ <b>Faltas:</b> ${est.faltasCometidas?.timeA || '—'} x ${est.faltasCometidas?.timeB || '—'}`);
  }
  if (isValid(est.impedimentos?.timeA) || isValid(est.impedimentos?.timeB)) {
    lines.push(`🚫 <b>Impedimentos:</b> ${est.impedimentos?.timeA || '—'} x ${est.impedimentos?.timeB || '—'}`);
  }

  if (lines.length === 0) return null;

  return `📊 <b>ESTATÍSTICAS DA PARTIDA</b>\n\n<b>${timeA} | ${timeB}</b>\n\n${lines.join('\n')}`;
}

/**
 * 3. ANÁLISE TÁTICA
 */
export function formatTacticalAnalysis(analysis: any): string {
  const timeA = (analysis.timeA || 'Time A').trim();
  const timeB = (analysis.timeB || 'Time B').trim();

  let text = `🧠 <b>PROTÁTICA | ANÁLISE TÁTICA</b>\n\n`;

  // Formações
  const formA = analysis.formacoes?.timeA?.esquema;
  const formB = analysis.formacoes?.timeB?.esquema;
  if (formA || formB) {
    text += `<b>FORMAÇÕES</b>\n\n`;
    if (formA) {
      text += `<b>${timeA}:</b>\n${formA}\n`;
      if (Array.isArray(analysis.formacoes.timeA.titulares) && analysis.formacoes.timeA.titulares.length > 0) {
        text += `<i>Titulares: ${analysis.formacoes.timeA.titulares.slice(0, 11).join(', ')}</i>\n`;
      }
      text += `\n`;
    }
    if (formB) {
      text += `<b>${timeB}:</b>\n${formB}\n`;
      if (Array.isArray(analysis.formacoes.timeB.titulares) && analysis.formacoes.timeB.titulares.length > 0) {
        text += `<i>Titulares: ${analysis.formacoes.timeB.titulares.slice(0, 11).join(', ')}</i>\n`;
      }
      text += `\n`;
    }
  }

  // Comportamento Ofensivo
  const ofA = [
    analysis.faseOfensiva?.timeA?.saidaDeBola,
    analysis.faseOfensiva?.timeA?.criacao,
    analysis.faseOfensiva?.timeA?.finalizacao_movimentacao,
  ].filter(Boolean).join(' ');
  const ofB = [
    analysis.faseOfensiva?.timeB?.saidaDeBola,
    analysis.faseOfensiva?.timeB?.criacao,
    analysis.faseOfensiva?.timeB?.finalizacao_movimentacao,
  ].filter(Boolean).join(' ');

  if (ofA || ofB) {
    text += `⚔️ <b>COMPORTAMENTO OFENSIVO</b>\n`;
    if (ofA) text += `• <b>${timeA}:</b> ${ofA}\n`;
    if (ofB) text += `• <b>${timeB}:</b> ${ofB}\n`;
    text += `\n`;
  }

  // Comportamento Defensivo
  const defA = [
    analysis.faseDefensiva?.timeA?.posicionamento,
    analysis.faseDefensiva?.timeA?.compactacao_pressao,
  ].filter(Boolean).join(' ');
  const defB = [
    analysis.faseDefensiva?.timeB?.posicionamento,
    analysis.faseDefensiva?.timeB?.compactacao_pressao,
  ].filter(Boolean).join(' ');

  if (defA || defB) {
    text += `🛡 <b>COMPORTAMENTO DEFENSIVO</b>\n`;
    if (defA) text += `• <b>${timeA}:</b> ${defA}\n`;
    if (defB) text += `• <b>${timeB}:</b> ${defB}\n`;
    text += `\n`;
  }

  // Transições
  const trA = analysis.faseDefensiva?.timeA?.transicao;
  const trB = analysis.faseDefensiva?.timeB?.transicao;
  if (trA || trB) {
    text += `🔄 <b>TRANSIÇÕES</b>\n`;
    if (trA) text += `• <b>${timeA}:</b> ${trA}\n`;
    if (trB) text += `• <b>${timeB}:</b> ${trB}\n`;
    text += `\n`;
  }

  // Pontos Fortes e Atenção
  const destaquesA = analysis.formacoes?.timeA?.destaquesFuncionais;
  const destaquesB = analysis.formacoes?.timeB?.destaquesFuncionais;
  const conclusao = analysis.conclusaoRecomendacoes;

  if (destaquesA || destaquesB) {
    text += `✅ <b>PONTOS FORTES</b>\n`;
    if (destaquesA) text += `• <b>${timeA}:</b> ${destaquesA}\n`;
    if (destaquesB) text += `• <b>${timeB}:</b> ${destaquesB}\n`;
    text += `\n`;
  }

  if (conclusao) {
    text += `⚠️ <b>PONTOS DE ATENÇÃO</b>\n`;
    text += `${conclusao}\n`;
  }

  return text.trim();
}

/**
 * 4. MAPA DE CALOR (CAPTION)
 */
export function formatHeatmapCaption(analysis: any): string {
  const timeA = (analysis.timeA || 'Time A').trim();
  const timeB = (analysis.timeB || 'Time B').trim();
  const mc = analysis.estatisticas?.mapaDeCalor;

  let cap = `🔥 <b>PROTÁTICA | MAPA DE CALOR</b>\n\n<b>${timeA} x ${timeB}</b>\n\n`;
  cap += `📍 <b>Ocupação dos espaços:</b>\n`;

  if (mc?.timeA) {
    cap += `• <b>${timeA}:</b> ${mc.timeA.tercoDefensivo || '—'} Def | ${mc.timeA.tercoMedio || '—'} Méd | ${mc.timeA.tercoOfensivo || '—'} Of\n`;
  }
  if (mc?.timeB) {
    cap += `• <b>${timeB}:</b> ${mc.timeB.tercoDefensivo || '—'} Def | ${mc.timeB.tercoMedio || '—'} Méd | ${mc.timeB.tercoOfensivo || '—'} Of\n`;
  }

  cap += `\n⚽ <b>Zonas de maior presença:</b>\n`;
  if (mc?.timeA?.tercoOfensivo && parseInt(mc.timeA.tercoOfensivo, 10) >= 35) {
    cap += `Presença ofensiva dominante do ${timeA} no último terço do campo.\n`;
  } else if (mc?.timeB?.tercoOfensivo && parseInt(mc.timeB.tercoOfensivo, 10) >= 35) {
    cap += `Pressão alta e linhas avançadas do ${timeB} no setor de ataque.\n`;
  } else {
    cap += `Jogo concentrado no terço médio e disputas no setor intermediário.\n`;
  }

  cap += `\n📊 <b>Comportamento territorial:</b>\n`;
  if (analysis.indicadoresAvancados?.fieldTilt?.timeA) {
    cap += `Field Tilt: ${analysis.indicadoresAvancados.fieldTilt.timeA} (${timeA}) x ${analysis.indicadoresAvancados.fieldTilt.timeB || '—'} (${timeB})`;
  } else {
    cap += `Equilíbrio tático na ocupação das entrelinhas e corredores laterais.`;
  }

  return cap.trim();
}

/**
 * 5. COMPARATIVO DAS EQUIPES
 */
export function formatTeamComparison(analysis: any): string | null {
  const timeA = (analysis.timeA || 'Time A').trim();
  const timeB = (analysis.timeB || 'Time B').trim();
  const est = analysis.estatisticas || {};
  const adv = analysis.indicadoresAvancados || {};

  const lines: string[] = [];
  const isValid = (v?: string) => v && v.trim() !== '' && v !== '—' && v !== 'N/D';

  if (isValid(est.posseDeBola?.timeA) || isValid(est.posseDeBola?.timeB)) {
    lines.push(`• <b>Posse de bola:</b> ${est.posseDeBola?.timeA || '—'} vs ${est.posseDeBola?.timeB || '—'}`);
  }
  if (isValid(est.finalizacoes?.timeA) || isValid(est.finalizacoes?.timeB)) {
    lines.push(`• <b>Finalizações:</b> ${est.finalizacoes?.timeA || '—'} vs ${est.finalizacoes?.timeB || '—'}`);
  }
  if (isValid(est.finalizacoesNoAlvo?.timeA) || isValid(est.finalizacoesNoAlvo?.timeB)) {
    lines.push(`• <b>Finalizações no alvo:</b> ${est.finalizacoesNoAlvo?.timeA || '—'} vs ${est.finalizacoesNoAlvo?.timeB || '—'}`);
  }
  if (isValid(adv.xG?.timeA) || isValid(adv.xG?.timeB)) {
    lines.push(`• <b>xG:</b> ${adv.xG?.timeA || '—'} vs ${adv.xG?.timeB || '—'}`);
  }
  if (isValid(adv.grandesChances?.timeA) || isValid(adv.grandesChances?.timeB)) {
    lines.push(`• <b>Grandes chances:</b> ${adv.grandesChances?.timeA || '—'} vs ${adv.grandesChances?.timeB || '—'}`);
  }
  if (isValid(est.passesCertos?.timeA) || isValid(est.passesCertos?.timeB)) {
    lines.push(`• <b>Passes certos:</b> ${est.passesCertos?.timeA || '—'} vs ${est.passesCertos?.timeB || '—'}`);
  }
  if (isValid(est.desarmes?.timeA) || isValid(est.desarmes?.timeB)) {
    lines.push(`• <b>Desarmes:</b> ${est.desarmes?.timeA || '—'} vs ${est.desarmes?.timeB || '—'}`);
  }
  if (isValid(est.escanteios?.timeA) || isValid(est.escanteios?.timeB)) {
    lines.push(`• <b>Escanteios:</b> ${est.escanteios?.timeA || '—'} vs ${est.escanteios?.timeB || '—'}`);
  }

  if (lines.length === 0) return null;

  return `⚖️ <b>PROTÁTICA | COMPARATIVO</b>\n\n<b>${timeA} 🆚 ${timeB}</b>\n\n${lines.join('\n')}`;
}

/**
 * 6. SCOUTING INDIVIDUAL DE JOGADOR
 */
export function formatSinglePlayerScouting(player: any): string {
  const nome = (player.nome || 'Jogador').toUpperCase();
  const time = player.time ? `\n🏟 <b>Equipe:</b> ${player.time}` : '';
  const pos = player.posicao ? `\n⚽ <b>Posição:</b> ${player.posicao}` : '';
  const camisa = player.camisa ? `\n🔢 <b>Número:</b> ${player.camisa}` : '';

  let msg = `👤 <b>PROTÁTICA | SCOUTING</b>\n\n<b>${nome}</b>${time}${pos}${camisa}\n\n`;

  if (Array.isArray(player.acoesPercebidas) && player.acoesPercebidas.length > 0) {
    msg += `📊 <b>AÇÕES PERCEBIDAS</b>\n`;
    player.acoesPercebidas.forEach((ac: string) => {
      msg += `• ${ac}\n`;
    });
    msg += `\n`;
  }

  if (Array.isArray(player.pontosFortes) && player.pontosFortes.length > 0) {
    msg += `💪 <b>PONTOS FORTES</b>\n`;
    player.pontosFortes.forEach((pf: string) => {
      msg += `• ${pf}\n`;
    });
    msg += `\n`;
  }

  if (Array.isArray(player.pontosAtencao) && player.pontosAtencao.length > 0) {
    msg += `⚠️ <b>PONTOS DE ATENÇÃO</b>\n`;
    player.pontosAtencao.forEach((pa: string) => {
      msg += `• ${pa}\n`;
    });
    msg += `\n`;
  }

  if (player.analise) {
    msg += `📈 <b>MÉTRICAS / RESUMO</b>\n${player.analise}\n`;
  }

  return msg.trim();
}

/**
 * 7. DESTAQUES DA PARTIDA
 */
export function formatMatchHighlights(analysis: any): string | null {
  let destaqueOf = '';
  let destaqueDef = '';
  let destaqueTat = '';
  let momentoImp = '';

  if (Array.isArray(analysis.analiseJogadores) && analysis.analiseJogadores.length > 0) {
    const attackers = analysis.analiseJogadores.filter((p: any) => 
      p.posicao?.toLowerCase().includes('ata') || 
      p.posicao?.toLowerCase().includes('pon') || 
      p.posicao?.toLowerCase().includes('cen') ||
      p.posicao?.toLowerCase().includes('meia')
    );
    const defenders = analysis.analiseJogadores.filter((p: any) => 
      p.posicao?.toLowerCase().includes('zag') || 
      p.posicao?.toLowerCase().includes('lat') || 
      p.posicao?.toLowerCase().includes('vol') ||
      p.posicao?.toLowerCase().includes('gol')
    );

    if (attackers.length > 0) {
      destaqueOf = `${attackers[0].nome} (${attackers[0].time || ''}) - ${attackers[0].acoesPercebidas?.[0] || attackers[0].analise || 'Destaque no setor ofensivo'}`;
    }
    if (defenders.length > 0) {
      destaqueDef = `${defenders[0].nome} (${defenders[0].time || ''}) - ${defenders[0].pontosFortes?.[0] || defenders[0].analise || 'Segurança defensiva e desarmes'}`;
    }
  }

  if (!destaqueOf && analysis.faseOfensiva?.timeA?.finalizacao_movimentacao) {
    destaqueOf = `${analysis.timeA}: ${analysis.faseOfensiva.timeA.finalizacao_movimentacao}`;
  }
  if (!destaqueDef && analysis.faseDefensiva?.timeA?.compactacao_pressao) {
    destaqueDef = `${analysis.timeA}: ${analysis.faseDefensiva.timeA.compactacao_pressao}`;
  }

  if (analysis.formacoes?.timeA?.destaquesFuncionais) {
    destaqueTat = `${analysis.timeA}: ${analysis.formacoes.timeA.destaquesFuncionais}`;
  } else if (analysis.conclusaoRecomendacoes) {
    destaqueTat = analysis.conclusaoRecomendacoes.slice(0, 140);
  }

  if (Array.isArray(analysis.linhaDoTempo) && analysis.linhaDoTempo.length > 0) {
    const ev = analysis.linhaDoTempo[0];
    momentoImp = `${ev.minuto || ''} ${ev.time ? `[${ev.time}]` : ''} - ${ev.descricao || ev.impactoTatico || ''}`.trim();
  } else if (analysis.momentosChave) {
    momentoImp = String(analysis.momentosChave).split('\n')[0].slice(0, 140);
  }

  const lines: string[] = [];
  if (destaqueOf) lines.push(`⚽ <b>Destaque ofensivo:</b>\n${destaqueOf}`);
  if (destaqueDef) lines.push(`🛡 <b>Destaque defensivo:</b>\n${destaqueDef}`);
  if (destaqueTat) lines.push(`🧠 <b>Destaque tático:</b>\n${destaqueTat}`);
  if (momentoImp) lines.push(`🔥 <b>Momento importante:</b>\n${momentoImp}`);

  if (lines.length === 0) return null;

  return `⭐ <b>PROTÁTICA | DESTAQUES DA PARTIDA</b>\n\n${lines.join('\n\n')}`;
}

/**
 * Cria inline keyboard buttons oficiais
 */
function buildInlineButtons(appUrl?: string) {
  const keyboard = [
    [
      {
        text: '🔴 VER MAIS ANÁLISES',
        url: 'https://t.me/ProTaticaAnalises',
      },
    ],
  ];

  if (appUrl && (appUrl.startsWith('http://') || appUrl.startsWith('https://'))) {
    keyboard[0].push({
      text: '⚽ ABRIR PROTÁTICA',
      url: appUrl,
    });
  }

  return { inline_keyboard: keyboard };
}

/**
 * Publicação Completa no Telegram
 * Envia estritamente os 8 conteúdos selecionados na ordem solicitada:
 * 1. Resumo da partida
 * 2. Estatísticas completas
 * 3. Análise tática
 * 4. Mapa de calor (imagem real)
 * 5. Comparativo
 * 6. Scouting de jogadores
 * 7. Destaques
 * 8. Relatório PDF (documento)
 */
export async function publishAnalysis(
  analysis: any,
  options: TelegramPublishOptions = {}
): Promise<{
  success: boolean;
  deliveredCount: number;
  itemsSent: string[];
  itemsFailed: string[];
  errors: string[];
}> {
  const config = getTelegramConfig();
  if (!config.hasToken) {
    return {
      success: false,
      deliveredCount: 0,
      itemsSent: [],
      itemsFailed: [],
      errors: ['Bot do Telegram sem token configurado.'],
    };
  }

  const targets: string[] = [];
  const requestedTarget = options.target || 'all';

  if ((requestedTarget === 'all' || requestedTarget === 'channel') && config.channelId) {
    targets.push(config.channelId);
  }
  if ((requestedTarget === 'all' || requestedTarget === 'vip') && config.vipGroupId) {
    targets.push(config.vipGroupId);
  }

  if (targets.length === 0) {
    return {
      success: false,
      deliveredCount: 0,
      itemsSent: [],
      itemsFailed: [],
      errors: ['Nenhum canal ou grupo VIP configurado nas opções de Telegram.'],
    };
  }

  // Determinar conteúdos selecionados
  // Se options.selectedContents não for informado (modo legado/auto), usar defaults
  const sel: TelegramSelectedContents = options.selectedContents || {
    resumo: true,
    estatisticas: true,
    tatica: true,
    mapaCalor: options.sendHeatmap ?? config.autoSendHeatmaps ?? true,
    scouting: true,
    comparativo: true,
    destaques: true,
    pdf: options.sendReportPdf ?? config.autoSendReport ?? Boolean(options.reportPdfBase64),
  };

  const errors: string[] = [];
  const itemsSent: string[] = [];
  const itemsFailed: string[] = [];
  let deliveredCount = 0;

  const inlineButtons = buildInlineButtons(options.appUrl || process.env.APP_URL);

  for (const chatId of targets) {
    let chatDelivered = 0;

    // 1. RESUMO DA PARTIDA
    if (sel.resumo !== false) {
      let summaryText = formatMatchSummary(analysis);
      if (options.customNote) {
        summaryText += `\n\n📌 <b>Nota:</b> ${options.customNote}`;
      }

      const res = await sendMessage(chatId, summaryText, {
        parse_mode: 'HTML',
        reply_markup: inlineButtons,
        tipo: 'resumo_partida',
      });

      if (res.ok) {
        chatDelivered++;
        if (!itemsSent.includes('Resumo da partida')) itemsSent.push('Resumo da partida');
        console.log('[TELEGRAM] resumo enviado');
      } else {
        itemsFailed.push(`Resumo (${chatId})`);
        errors.push(`Falha no Resumo para ${chatId}: ${res.error}`);
      }
      await sleep(350);
    }

    // 2. ESTATÍSTICAS COMPLETAS
    if (sel.estatisticas !== false) {
      const statsText = formatMatchStatistics(analysis);
      if (statsText) {
        const res = await sendMessage(chatId, statsText, {
          parse_mode: 'HTML',
          tipo: 'estatisticas_completas',
        });

        if (res.ok) {
          chatDelivered++;
          if (!itemsSent.includes('Estatísticas completas')) itemsSent.push('Estatísticas completas');
          console.log('[TELEGRAM] estatísticas enviadas');
        } else {
          itemsFailed.push(`Estatísticas (${chatId})`);
          errors.push(`Falha nas Estatísticas para ${chatId}: ${res.error}`);
        }
        await sleep(350);
      }
    }

    // 3. ANÁLISE TÁTICA
    if (sel.tatica !== false) {
      const tacticalText = formatTacticalAnalysis(analysis);
      if (tacticalText) {
        const res = await sendMessage(chatId, tacticalText, {
          parse_mode: 'HTML',
          tipo: 'analise_tatica',
        });

        if (res.ok) {
          chatDelivered++;
          if (!itemsSent.includes('Análise tática')) itemsSent.push('Análise tática');
          console.log('[TELEGRAM] tatica enviada');
        } else {
          itemsFailed.push(`Análise tática (${chatId})`);
          errors.push(`Falha na Análise Tática para ${chatId}: ${res.error}`);
        }
        await sleep(350);
      }
    }

    // 4. MAPA DE CALOR (FOTO REAL)
    if (sel.mapaCalor !== false && options.heatmapDataUrl) {
      const caption = formatHeatmapCaption(analysis);
      const res = await sendPhoto(chatId, options.heatmapDataUrl, caption, {
        parse_mode: 'HTML',
        tipo: 'mapa_calor',
      });

      if (res.ok) {
        chatDelivered++;
        if (!itemsSent.includes('Mapa de calor')) itemsSent.push('Mapa de calor');
        console.log('[TELEGRAM] mapa enviado');
      } else {
        itemsFailed.push(`Mapa de calor (${chatId})`);
        errors.push(`Falha no Mapa de Calor para ${chatId}: ${res.error}`);
      }
      await sleep(350);
    }

    // 5. COMPARATIVO DAS EQUIPES
    if (sel.comparativo !== false) {
      const compText = formatTeamComparison(analysis);
      if (compText) {
        const res = await sendMessage(chatId, compText, {
          parse_mode: 'HTML',
          tipo: 'comparativo_equipes',
        });

        if (res.ok) {
          chatDelivered++;
          if (!itemsSent.includes('Comparativo')) itemsSent.push('Comparativo');
          console.log('[TELEGRAM] comparativo enviado');
        } else {
          itemsFailed.push(`Comparativo (${chatId})`);
          errors.push(`Falha no Comparativo para ${chatId}: ${res.error}`);
        }
        await sleep(350);
      }
    }

    // 6. SCOUTING DE JOGADORES
    if (sel.scouting !== false) {
      const players = Array.isArray(analysis.analiseJogadores)
        ? analysis.analiseJogadores.filter((p: any) => p && p.nome && p.nome.trim().length >= 2 && p.nivelConfianca !== 'baixa')
        : [];

      if (players.length > 0) {
        let playersDelivered = 0;
        for (const pl of players.slice(0, 4)) {
          const scoutingText = formatSinglePlayerScouting(pl);

          // Se tiver foto confirmada e válida
          if (pl.foto && (pl.foto.startsWith('http://') || pl.foto.startsWith('https://'))) {
            const resPhoto = await sendPhoto(chatId, pl.foto, scoutingText, {
              parse_mode: 'HTML',
              tipo: 'scouting_jogador_foto',
            });
            if (resPhoto.ok) {
              playersDelivered++;
            } else {
              // Fallback para envio em texto
              const resMsg = await sendMessage(chatId, scoutingText, {
                parse_mode: 'HTML',
                tipo: 'scouting_jogador',
              });
              if (resMsg.ok) playersDelivered++;
            }
          } else {
            const resMsg = await sendMessage(chatId, scoutingText, {
              parse_mode: 'HTML',
              tipo: 'scouting_jogador',
            });
            if (resMsg.ok) playersDelivered++;
          }
          await sleep(350);
        }

        if (playersDelivered > 0) {
          chatDelivered++;
          if (!itemsSent.includes('Scouting de jogadores')) itemsSent.push('Scouting de jogadores');
          console.log('[TELEGRAM] scouting enviado');
        }
      }
    }

    // 7. DESTAQUES DA PARTIDA
    if (sel.destaques !== false) {
      const highlightsText = formatMatchHighlights(analysis);
      if (highlightsText) {
        const res = await sendMessage(chatId, highlightsText, {
          parse_mode: 'HTML',
          tipo: 'destaques_partida',
        });

        if (res.ok) {
          chatDelivered++;
          if (!itemsSent.includes('Destaques da partida')) itemsSent.push('Destaques da partida');
          console.log('[TELEGRAM] destaques enviados');
        } else {
          itemsFailed.push(`Destaques (${chatId})`);
          errors.push(`Falha nos Destaques para ${chatId}: ${res.error}`);
        }
        await sleep(350);
      }
    }

    // 8. RELATÓRIO PDF (DOCUMENTO)
    if (sel.pdf !== false) {
      console.log('[PDF] envio Telegram iniciado para chat:', chatId);
      try {
        let pdfBuffer: Buffer | undefined;
        let pdfFname: string | undefined;

        if (options.reportPdfBase64) {
          const parsed = parsePayloadToBuffer(options.reportPdfBase64);
          if (parsed && parsed.length > 500 && parsed.subarray(0, 5).toString('ascii').startsWith('%PDF-')) {
            pdfBuffer = parsed;
            pdfFname = options.pdfFilename;
            console.log('[PDF] Usando buffer do frontend válido:', parsed.length, 'bytes');
          }
        }

        if (!pdfBuffer) {
          console.log('[PDF] Compilando PDF via serviço central de PDF...');
          const pdfResult = await generateAnalysisPdf(analysis);
          pdfBuffer = pdfResult.buffer;
          pdfFname = pdfResult.filename;
          console.log('[PDF] Buffer compilado com sucesso:', pdfResult.size, 'bytes');
        }

        const cleanTimeA = String(analysis.timeA || 'TimeA').replace(/[^a-zA-Z0-9]/g, '_');
        const cleanTimeB = String(analysis.timeB || 'TimeB').replace(/[^a-zA-Z0-9]/g, '_');
        const fname = sanitizeFilename(pdfFname || `ProTatica_${cleanTimeA}_x_${cleanTimeB}.pdf`);
        const caption = `📄 <b>PROTÁTICA | RELATÓRIO DE INTELIGÊNCIA TÁTICA</b>\n\nRelatório tático e estatístico completo da partida.`;

        const res = await sendDocument(chatId, pdfBuffer, fname, caption, {
          parse_mode: 'HTML',
          tipo: 'relatorio_pdf',
        });

        if (res.ok) {
          chatDelivered++;
          if (!itemsSent.includes('Relatório PDF')) itemsSent.push('Relatório PDF');
          console.log('[PDF] envio Telegram concluído com sucesso');
        } else {
          itemsFailed.push(`Relatório PDF (${chatId})`);
          errors.push(`Falha no Relatório PDF para ${chatId}: ${res.error}`);
          console.error('[PDF ERROR] Falha no envio ao Telegram:', res.error);
        }
      } catch (pdfErr: any) {
        console.error('[PDF ERROR] Erro na geração/envio do PDF para Telegram:', pdfErr);
        itemsFailed.push(`Relatório PDF (${chatId})`);
        errors.push(`Falha no Relatório PDF para ${chatId}: ${pdfErr.message || pdfErr}`);
      }
      await sleep(350);
    }

    if (chatDelivered > 0) {
      deliveredCount++;
    }
  }

  return {
    success: deliveredCount > 0 && itemsFailed.length === 0,
    deliveredCount,
    itemsSent,
    itemsFailed,
    errors,
  };
}

/**
 * Trata requisições de Webhook vindas da Telegram Bot API
 * Suporta comandos: /start, /jogos, /analise, /estatisticas, /historico, /comparar, /ajuda
 */
export async function handleTelegramWebhook(update: any): Promise<{ handled: boolean; reply?: string }> {
  if (!update || !update.message) {
    return { handled: false };
  }

  const message = update.message;
  const chatId = String(message.chat?.id || '');
  const text = (message.text || '').trim();

  if (!chatId || !text) {
    return { handled: false };
  }

  const [rawCmd, ...args] = text.split(' ');
  const cmd = rawCmd.toLowerCase().split('@')[0];
  const query = args.join(' ').trim();

  const config = getTelegramConfig();
  const allowedChats = [config.channelId, config.vipGroupId].map(String).map((v) => v.trim()).filter(Boolean);
  if (allowedChats.length === 0 || !allowedChats.includes(chatId)) {
    // Never expose private scouting data to arbitrary chats that discover the bot.
    return { handled: true, reply: 'unauthorized_chat' };
  }

  const dataUserId = String(process.env.TELEGRAM_DATA_USER_ID || '').trim();
  const dataCommands = new Set(['/jogos', '/historico', '/analise', '/estatisticas', '/comparar']);
  if (dataCommands.has(cmd) && !dataUserId) {
    await sendMessage(
      chatId,
      '🔒 Consulta de dados privados desativada. Configure TELEGRAM_DATA_USER_ID no servidor para vincular o bot a uma conta específica.',
      { parse_mode: 'HTML', tipo: 'bot_command' }
    );
    return { handled: true, reply: 'data_scope_not_configured' };
  }

  // /start ou /ajuda
  if (cmd === '/start' || cmd === '/ajuda' || cmd === '/help') {
    const welcome = `🏆 <b>PROTÁTICA | Assistente de Inteligência Tática</b>

Bem-vindo ao sistema de análise tática de futebol com IA e auditoria de dados!

📌 <b>Comandos disponíveis:</b>
/jogos - Listar jogos analisados recentemente
/historico - Exibir as análises salvas no ProTática
/analise [nome ou ID] - Consultar análise completa de uma partida
/estatisticas [nome ou ID] - Ver estatísticas detalhadas
/comparar [time A] vs [time B] - Comparar métricas entre equipes
/ajuda - Exibir este menu informativo

<i>Para análises completas e geração de PDFs, acesse a plataforma web ProTática.</i>`;
    await sendMessage(chatId, welcome, { parse_mode: 'HTML', tipo: 'bot_command' });
    return { handled: true, reply: 'start' };
  }

  // /jogos ou /historico
  if (cmd === '/jogos' || cmd === '/historico') {
    const items = listAnalyses(10, dataUserId);
    if (items.length === 0) {
      await sendMessage(
        chatId,
        '📭 <i>Nenhuma análise foi encontrada na base do ProTática ainda. Cadastre novas análises através da plataforma web.</i>',
        { parse_mode: 'HTML', tipo: 'bot_command' }
      );
      return { handled: true, reply: 'empty_history' };
    }

    let response = `📋 <b>ÚLTIMAS ANÁLISES REGISTRADAS (${items.length}):</b>\n\n`;
    items.forEach((item, index) => {
      const placar = item.placar && item.placar !== 'não identificado' ? ` (${item.placar})` : '';
      const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : '';
      response += `<b>${index + 1}. ${item.timeA} x ${item.timeB}${placar}</b>\n`;
      response += `📅 Data: ${date} | 🔑 ID: <code>${item.id}</code>\n`;
      response += `👉 Digite <code>/analise ${item.id}</code> para ver detalhes\n\n`;
    });

    await sendMessage(chatId, response, { parse_mode: 'HTML', tipo: 'bot_command' });
    return { handled: true, reply: 'jogos' };
  }

  // /analise [id ou nome]
  if (cmd === '/analise') {
    if (!query) {
      await sendMessage(
        chatId,
        '⚠️ Por favor, informe o ID ou nome de um time para consultar a análise.\nExemplo: <code>/analise Flamengo</code> ou <code>/analise 1234abcd</code>',
        { parse_mode: 'HTML', tipo: 'bot_command' }
      );
      return { handled: true, reply: 'missing_query' };
    }

    const allAnalyses = listAllFullAnalyses(dataUserId);
    let found = allAnalyses.find(
      (a: any) =>
        (a.analysisId && a.analysisId.toLowerCase() === query.toLowerCase()) ||
        (a.id && String(a.id).toLowerCase() === query.toLowerCase())
    );

    if (!found) {
      const lowerQuery = query.toLowerCase();
      found = allAnalyses.find(
        (a: any) =>
          (a.timeA && a.timeA.toLowerCase().includes(lowerQuery)) ||
          (a.timeB && a.timeB.toLowerCase().includes(lowerQuery))
      );
    }

    if (!found) {
      await sendMessage(
        chatId,
        `❌ Nenhuma análise encontrada para <b>"${query}"</b>. Digite /jogos para ver a lista de partidas salvas.`,
        { parse_mode: 'HTML', tipo: 'bot_command' }
      );
      return { handled: true, reply: 'not_found' };
    }

    const summary = formatMatchSummary(found);
    await sendMessage(chatId, summary, { parse_mode: 'HTML', tipo: 'bot_command' });
    return { handled: true, reply: 'analise_found' };
  }

  // /estatisticas [id ou nome]
  if (cmd === '/estatisticas') {
    if (!query) {
      await sendMessage(
        chatId,
        '⚠️ Informe o ID ou nome de um time para ver as estatísticas.\nExemplo: <code>/estatisticas Flamengo</code>',
        { parse_mode: 'HTML', tipo: 'bot_command' }
      );
      return { handled: true, reply: 'missing_query' };
    }

    const allAnalyses = listAllFullAnalyses(dataUserId);
    const lowerQuery = query.toLowerCase();
    const found = allAnalyses.find(
      (a: any) =>
        (a.analysisId && a.analysisId.toLowerCase() === lowerQuery) ||
        (a.id && String(a.id).toLowerCase() === lowerQuery) ||
        (a.timeA && a.timeA.toLowerCase().includes(lowerQuery)) ||
        (a.timeB && a.timeB.toLowerCase().includes(lowerQuery))
    );

    if (!found) {
      await sendMessage(
        chatId,
        `❌ Nenhuma partida encontrada para <b>"${query}"</b>. Digite /jogos para ver as opções salvas.`,
        { parse_mode: 'HTML', tipo: 'bot_command' }
      );
      return { handled: true, reply: 'not_found' };
    }

    const statsMsg = formatMatchStatistics(found) || 'Estatísticas não disponíveis para esta partida.';
    await sendMessage(chatId, statsMsg, { parse_mode: 'HTML', tipo: 'bot_command' });
    return { handled: true, reply: 'estatisticas_found' };
  }

  // /comparar [time A] vs [time B]
  if (cmd === '/comparar') {
    const allAnalyses = listAllFullAnalyses(dataUserId);
    if (allAnalyses.length === 0) {
      await sendMessage(
        chatId,
        '📭 Nenhuma análise disponível no banco para comparação.',
        { parse_mode: 'HTML', tipo: 'bot_command' }
      );
      return { handled: true, reply: 'no_analyses' };
    }

    let team1Name = '';
    let team2Name = '';

    if (query.includes(' vs ') || query.includes(' x ') || query.includes(' - ')) {
      const sep = query.includes(' vs ') ? ' vs ' : query.includes(' x ') ? ' x ' : ' - ';
      const parts = query.split(sep);
      team1Name = parts[0].trim().toLowerCase();
      team2Name = (parts[1] || '').trim().toLowerCase();
    }

    if (!team1Name) {
      const teamCounts: Record<string, number> = {};
      allAnalyses.forEach((a: any) => {
        if (a.timeA) teamCounts[a.timeA] = (teamCounts[a.timeA] || 0) + 1;
        if (a.timeB) teamCounts[a.timeB] = (teamCounts[a.timeB] || 0) + 1;
      });

      const topTeams = Object.entries(teamCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([t, count]) => `• <b>${t}</b> (${count} jogo${count > 1 ? 's' : ''})`)
        .join('\n');

      const helpCompare = `⚖️ <b>COMPARATIVO DE EQUIPES NO PROTÁTICA</b>

Para comparar duas equipes existentes no banco, envie:
<code>/comparar Time A vs Time B</code>

<b>Equipes com análises no sistema:</b>
${topTeams || 'Nenhuma equipe encontrada.'}`;

      await sendMessage(chatId, helpCompare, { parse_mode: 'HTML', tipo: 'bot_command' });
      return { handled: true, reply: 'compare_help' };
    }

    const statsForTeam = (tName: string) => {
      const matches = allAnalyses.filter(
        (a: any) =>
          (a.timeA && a.timeA.toLowerCase().includes(tName)) ||
          (a.timeB && a.timeB.toLowerCase().includes(tName))
      );

      let totalShots = 0;
      let totalOnTarget = 0;
      let totalPossession = 0;
      const count = matches.length;

      matches.forEach((m: any) => {
        const isTeamA = m.timeA && m.timeA.toLowerCase().includes(tName);
        const st = m.estatisticas || {};
        const pos = parseInt(isTeamA ? st.posseDeBola?.timeA || '50' : st.posseDeBola?.timeB || '50', 10) || 50;
        const fin = parseInt(isTeamA ? st.finalizacoes?.timeA || '0' : st.finalizacoes?.timeB || '0', 10) || 0;
        const ont = parseInt(isTeamA ? st.finalizacoesNoAlvo?.timeA || '0' : st.finalizacoesNoAlvo?.timeB || '0', 10) || 0;
        totalPossession += pos;
        totalShots += fin;
        totalOnTarget += ont;
      });

      return {
        count,
        avgPossession: count > 0 ? (totalPossession / count).toFixed(1) + '%' : 'N/D',
        avgShots: count > 0 ? (totalShots / count).toFixed(1) : 'N/D',
        avgOnTarget: count > 0 ? (totalOnTarget / count).toFixed(1) : 'N/D',
      };
    };

    const s1 = statsForTeam(team1Name);
    const s2 = team2Name ? statsForTeam(team2Name) : null;

    let compMsg = `⚖️ <b>COMPARATIVO DE DESEMPENHO REAL NO PROTÁTICA</b>\n\n`;
    compMsg += `🔹 <b>${team1Name.toUpperCase()}</b> (${s1.count} análises):\n`;
    compMsg += `• Média de Posse: <b>${s1.avgPossession}</b>\n`;
    compMsg += `• Média de Finalizações: <b>${s1.avgShots}</b>\n`;
    compMsg += `• Finalizações no Alvo: <b>${s1.avgOnTarget}</b>\n\n`;

    if (s2 && team2Name) {
      compMsg += `🔸 <b>${team2Name.toUpperCase()}</b> (${s2.count} análises):\n`;
      compMsg += `• Média de Posse: <b>${s2.avgPossession}</b>\n`;
      compMsg += `• Média de Finalizações: <b>${s2.avgShots}</b>\n`;
      compMsg += `• Finalizações no Alvo: <b>${s2.avgOnTarget}</b>\n\n`;
    }

    compMsg += `<i>Utilize o painel de Comparação da plataforma web para gráficos cruzados completos.</i>`;

    await sendMessage(chatId, compMsg, { parse_mode: 'HTML', tipo: 'bot_command' });
    return { handled: true, reply: 'compared' };
  }

  // Comando não reconhecido
  await sendMessage(
    chatId,
    `🤖 Olá! Não reconheci o comando <code>${cmd}</code>.\nDigite <b>/ajuda</b> para ver todos os comandos disponíveis no ProTática.`,
    { parse_mode: 'HTML', tipo: 'bot_command' }
  );
  return { handled: true, reply: 'unknown_cmd' };
}
