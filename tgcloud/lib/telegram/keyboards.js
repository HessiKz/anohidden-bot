// Inline keyboards for the anonymous conversation experience. Locale-aware.
import { CALLBACK } from '../constants.js';
import { t } from '../i18n/index.js';

export function anonymousMessageKeyboard(locale, publicToken, options = {}) {
  const rows = [
    [
      { text: t(locale, 'btn.reply'), callback_data: `${CALLBACK.ANON_REPLY}${publicToken}` },
      { text: t(locale, 'btn.report'), callback_data: `${CALLBACK.ANON_REPORT}${publicToken}` },
    ],
    [{ text: t(locale, 'btn.blockSender'), callback_data: `${CALLBACK.ANON_BLOCK}${publicToken}` }],
  ];
  if (options.canReveal) {
    rows.push([
      {
        text: t(locale, 'btn.revealSender'),
        callback_data: `${CALLBACK.ANON_REVEAL}${publicToken}`,
      },
    ]);
  }
  return { inline_keyboard: rows };
}

export function reportReasonKeyboard(locale, publicToken) {
  return {
    inline_keyboard: [
      [
        { text: t(locale, 'btn.reasonSpam'), callback_data: `${CALLBACK.ANON_REPORT_REASON}${publicToken}:spam` },
        { text: t(locale, 'btn.reasonAbuse'), callback_data: `${CALLBACK.ANON_REPORT_REASON}${publicToken}:abuse` },
      ],
      [
        { text: t(locale, 'btn.reasonScam'), callback_data: `${CALLBACK.ANON_REPORT_REASON}${publicToken}:scam` },
        { text: t(locale, 'btn.reasonOther'), callback_data: `${CALLBACK.ANON_REPORT_REASON}${publicToken}:other` },
      ],
    ],
  };
}

export function helpKeyboard(locale) {
  return {
    inline_keyboard: [
      [{ text: t(locale, 'btn.myLink'), callback_data: `${CALLBACK.USER}link` }],
      [
        { text: t(locale, 'btn.howReplies'), callback_data: `${CALLBACK.USER}replyhelp` },
        { text: t(locale, 'btn.privacy'), callback_data: `${CALLBACK.USER}privacy` },
      ],
    ],
  };
}

export function startKeyboard(locale, shareUrl) {
  return {
    inline_keyboard: [
      [{ text: t(locale, 'btn.shareMyLink'), url: shareUrl }],
      [
        { text: t(locale, 'btn.howItWorks'), callback_data: `${CALLBACK.USER}help` },
        { text: t(locale, 'btn.privacy'), callback_data: `${CALLBACK.USER}privacy` },
      ],
    ],
  };
}

export function backToHelpKeyboard(locale) {
  return {
    inline_keyboard: [[{ text: t(locale, 'btn.backToHelp'), callback_data: `${CALLBACK.USER}help` }]],
  };
}
