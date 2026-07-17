// Public (end-user) pages rendered on the server: the expired-link page and the
// WeChat live-QR page. Also holds the public i18n strings and language picker.
import { escapeHtml } from './util.js';

// Public (end-user) pages are rendered on the server. The visitor's language is
// detected from the Accept-Language header and falls back to English.
const PUBLIC_LANGS = ['en', 'zh', 'ru', 'ja', 'ko', 'es', 'fr', 'de'];
const PUBLIC_I18N = {
  en: {
    expiredTitle: 'Link Expired',
    expiredHeading: 'has expired',
    expiredOn: 'Expired on',
    expiredFooter: 'Contact the admin to update this link',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: 'Long-press to recognize the QR code below',
    wechatFooter: 'If the QR code expires, contact the author to update it'
  },
  zh: {
    expiredTitle: '链接已过期',
    expiredHeading: '已过期',
    expiredOn: '过期时间',
    expiredFooter: '如需访问，请联系管理员更新链接',
    wechatTitle: '微信群二维码',
    wechatHeading: '微信群二维码',
    wechatNotice: '请长按识别下方二维码',
    wechatFooter: '二维码失效请联系作者更新'
  },
  ru: {
    expiredTitle: 'Ссылка устарела',
    expiredHeading: 'устарела',
    expiredOn: 'Дата окончания',
    expiredFooter: 'Для доступа обратитесь к администратору',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: 'Нажмите и удерживайте, чтобы распознать QR-код ниже',
    wechatFooter: 'Если QR-код устарел, обратитесь к автору для обновления'
  },
  ja: {
    expiredTitle: 'リンクは期限切れです',
    expiredHeading: 'は期限切れです',
    expiredOn: '有効期限',
    expiredFooter: 'アクセスするには管理者にリンクの更新を依頼してください',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: '下のQRコードを長押しして認識してください',
    wechatFooter: 'QRコードが無効な場合は作者に更新を依頼してください'
  },
  ko: {
    expiredTitle: '링크가 만료되었습니다',
    expiredHeading: '만료되었습니다',
    expiredOn: '만료 날짜',
    expiredFooter: '접속하려면 관리자에게 링크 업데이트를 요청하세요',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: '아래 QR 코드를 길게 눌러 인식하세요',
    wechatFooter: 'QR 코드가 만료되면 작성자에게 업데이트를 요청하세요'
  },
  es: {
    expiredTitle: 'Enlace caducado',
    expiredHeading: 'ha caducado',
    expiredOn: 'Caducó el',
    expiredFooter: 'Para acceder, contacte al administrador para actualizar el enlace',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: 'Mantenga pulsado para reconocer el código QR de abajo',
    wechatFooter: 'Si el código QR caduca, contacte al autor para actualizarlo'
  },
  fr: {
    expiredTitle: 'Lien expiré',
    expiredHeading: 'a expiré',
    expiredOn: 'Expiré le',
    expiredFooter: 'Pour y accéder, contactez l\'administrateur pour mettre à jour le lien',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: 'Appuyez longuement pour reconnaître le QR code ci-dessous',
    wechatFooter: 'Si le QR code expire, contactez l\'auteur pour le mettre à jour'
  },
  de: {
    expiredTitle: 'Link abgelaufen',
    expiredHeading: 'ist abgelaufen',
    expiredOn: 'Abgelaufen am',
    expiredFooter: 'Wenden Sie sich an den Administrator, um den Link zu aktualisieren',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: 'Halten Sie zum Erkennen des QR-Codes unten lang',
    wechatFooter: 'Wenn der QR-Code abläuft, wenden Sie sich an den Autor zur Aktualisierung'
  }
};

// Pick the public-page language from the Accept-Language header.
function pickLang(request) {
  const header = request.headers.get('Accept-Language') || '';
  const parts = header.split(',');
  for (const part of parts) {
    const code = part.split(';')[0].trim().split('-')[0].toLowerCase();
    if (PUBLIC_LANGS.indexOf(code) !== -1) return code;
  }
  return 'en';
}

// Render the "link expired" page.
function renderExpiredPage({ name, lang, T, expiry }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${T.expiredTitle}</title>
    <style>
        :root {
            color-scheme: light dark;
            --brand: #2563EB;
            --bg: #f1f5f9;
            --card: #ffffff;
            --title: #0f172a;
            --text: #475569;
            --muted: #94a3b8;
            --border: #e2e8f0;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #0f172a;
                --card: #1e293b;
                --title: #e2e8f0;
                --text: #94a3b8;
                --muted: #64748b;
                --border: #334155;
            }
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
            background: var(--bg);
            -webkit-font-smoothing: antialiased;
        }
        .card {
            width: 100%;
            max-width: 360px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 36px 24px;
            text-align: center;
            box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 20px 40px -24px rgba(15,23,42,.25);
        }
        .icon {
            width: 56px; height: 56px;
            margin: 0 auto 18px;
            border-radius: 14px;
            display: grid; place-items: center;
            background: color-mix(in oklab, var(--brand) 12%, transparent);
            color: var(--brand);
        }
        .icon svg { width: 28px; height: 28px; }
        .title { font-size: 20px; font-weight: 700; color: var(--title); margin: 0 0 10px; }
        .message { font-size: 14px; color: var(--text); margin: 8px 0; line-height: 1.6; }
        .footer { font-size: 13px; color: var(--muted); margin-top: 22px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>
        <h1 class="title">${name ? escapeHtml(name) + ' ' + T.expiredHeading : T.expiredTitle}</h1>
        <p class="message">${T.expiredOn}: ${new Date(Number(expiry)).toLocaleDateString()}</p>
        <p class="footer">${T.expiredFooter}</p>
    </div>
</body>
</html>`;
}

// Render the WeChat live-QR page.
function renderWechatPage({ name, lang, T, qrCodeData }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name ? escapeHtml(name) : T.wechatTitle}</title>
    <style>
        :root {
            color-scheme: light dark;
            --brand: #2563EB;
            --bg: #f1f5f9;
            --card: #ffffff;
            --title: #0f172a;
            --text: #475569;
            --muted: #94a3b8;
            --border: #e2e8f0;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #0f172a;
                --card: #1e293b;
                --title: #e2e8f0;
                --text: #94a3b8;
                --muted: #64748b;
                --border: #334155;
            }
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
            background: var(--bg);
            -webkit-font-smoothing: antialiased;
        }
        .card {
            width: 100%;
            max-width: 360px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 32px 24px;
            text-align: center;
            box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 20px 40px -24px rgba(15,23,42,.25);
        }
        .icon {
            width: 52px; height: 52px;
            margin: 0 auto 14px;
            border-radius: 14px;
            display: grid; place-items: center;
            background: color-mix(in oklab, var(--brand) 12%, transparent);
        }
        .icon img { width: 30px; height: 30px; }
        .title { font-size: 20px; font-weight: 700; color: var(--title); margin: 0 0 8px; }
        .notice { font-size: 15px; color: var(--text); margin: 14px 0 0; line-height: 1.6; }
        .qr-wrap {
            margin: 20px auto;
            padding: 14px;
            background: #ffffff;
            border-radius: 12px;
            width: fit-content;
            box-shadow: 0 4px 12px -6px rgba(15,23,42,.2);
        }
        .qr-code { width: 240px; height: 240px; display: block; border-radius: 6px; }
        .footer { font-size: 13px; color: var(--muted); margin-top: 18px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon"><img src="wechat.svg" alt="WeChat"></div>
        <h1 class="title">${name ? escapeHtml(name) : T.wechatHeading}</h1>
        <p class="notice">${T.wechatNotice}</p>
        <div class="qr-wrap"><img class="qr-code" src="${qrCodeData}" alt="WeChat QR"></div>
        <p class="footer">${T.wechatFooter}</p>
    </div>
</body>
</html>`;
}

export {
  PUBLIC_LANGS,
  PUBLIC_I18N,
  pickLang,
  renderExpiredPage,
  renderWechatPage
};
