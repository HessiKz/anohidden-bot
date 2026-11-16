// Persian (Farsi) catalog — the platform's default language.
//
// Values are either plain strings or functions. Functions receive a params
// object and must return the final string; interpolation is done in code so
// every message can shape Persian sentence structure freely.

export const fa = {
  // ------------------------------------------------------------------
  // Generic
  // ------------------------------------------------------------------
  'common.backToHelp': '« بازگشت به راهنما',
  'common.back': '« بازگشت',
  'common.cancel': 'لغو',
  'common.close': 'بستن',
  'common.confirm': 'تأیید',
  'common.continue': 'ادامه',
  'common.unknown': 'ناشناس',
  'common.none': 'هیچ',
  'common.never': 'هرگز',
  'common.yes': 'بله',
  'common.no': 'خیر',
  'common.page': 'صفحه',
  'common.total': 'مجموع',

  // ------------------------------------------------------------------
  // User-facing texts
  // ------------------------------------------------------------------
  'user.onboarding':
    (p) =>
      `👋 <b>به پیام‌رسان ناشناس خوش آمدید</b>\n\n` +
      `لینک ناشناس شخصی شما:\n<code>${p.link}</code>\n\n` +
      `این لینک را با هر کسی به اشتراک بگذارید. وقتی آن را باز کند و پیامی بفرستد، پیامش همین‌جا به شما می‌رسد؛ بدون آن‌که نام، آیدی یا شناسه‌اش دیده شود.\n\n` +
      `<b>چطور پاسخ بدهید؟</b>\n` +
      `روی پیام ناشناس از قابلیت <b>Reply</b> تلگرام استفاده کنید. ربات پاسخ شما را برای فرستنده می‌فرستد. او هم می‌تواند به پاسخ شما reply کند و گفتگو ادامه می‌یابد — هر دو طرف ناشناس می‌مانند.\n\n` +
      `<b>ابزارهای شما</b>\n` +
      `• /link — نمایش همین لینک\n` +
      `• /roll — باطل کردن و ساخت لینک جدید\n` +
      `• /language — تغییر زبان ربات\n` +
      `• /help — نحوه کار\n\n` +
      `هر کاربر فقط <b>یک لینک فعال</b> دارد. با /roll بلافاصله لینک قبلی باطل می‌شود، اما گفتگوهای موجود سرِ جایشان می‌مانند.`,

  'user.target.self':
    `🙂 <b>این لینک خودِ شماست.</b>\n\n` +
    `آن را برای دیگری بفرستید تا ناشناس برایتان پیام بنویسد. برای کپی از /link استفاده کنید.`,

  'user.target.unavailable': `⚠️ این لینک ناشناس در حال حاضر در دسترس نیست.`,

  'user.target.body':
    `🕶 <b>حالت پیام ناشناس</b>\n\n` +
    `پیامی که می‌خواهید برسد را بفرستید. متن، عکس، ویدیو، ویس، فایل، استیکر، آلبوم، مخاطب، موقعیت مکانی و نظرسنجی پشتیبانی می‌شود.\n\n` +
    `نام، آیدی و شناسهٔ عددی شما برای گیرنده نمایش داده نمی‌شود. پاسخ‌دادن از طریق قابلیت Reply تلگرام انجام می‌شود.\n\n` +
    `می‌توانید در همین جلسه چند پیام بفرستید. برای گفتگوی جدید، دوباره لینک را باز کنید.`,

  'user.help':
    (p) =>
      `🕶 <b>پیام‌رسانی ناشناس چطور کار می‌کند</b>\n\n` +
      `<b>۱. لینک خود را به اشتراک بگذارید</b>\n` +
      `هر کاربر یک لینک فعال دارد: <code>${p.link}</code>. برای دیدن لینک خود /link را بزنید.\n\n` +
      `<b>۲. ناشناس دریافت کنید</b>\n` +
      `هرکس لینک شما را باز کند می‌تواند متن، رسانه، آلبوم، مخاطب، موقعیت مکانی و نظرسنجی بفرستد. شما محتوا را می‌بینید — نه هویت او را.\n\n` +
      `<b>۳. با Reply تلگرام پاسخ دهید</b>\n` +
      `روی خودِ پیام ناشناس Reply کنید. ربات مسیر تحویل را از همان پیام تلگرام می‌خواند. دکمهٔ Reply داخل ربات فقط یادآوری است و جادوگری نمی‌کند.\n\n` +
      `<b>۴. ابزارها</b>\n` +
      `• <b>گزارش</b> — پیام برای بررسی ثبت می‌شود.\n` +
      `• <b>مسدودسازی</b> جلوی پیام‌های بعدی همان فرستنده را می‌گیرد.\n` +
      `• /roll لینک شما را فوراً عوض می‌کند؛ گفتگوهای قبلی سالم می‌مانند.\n\n` +
      (p.isSuperadmin
        ? `شما ابرمدیر هستید؛ با /admin داشبورد مدیریتی را باز کنید.`
        : `مدل کامل حریم خصوصی: /about`),

  'user.privacy':
    `🔐 <b>مدل حریم خصوصی</b>\n\n` +
    `• گیرندهٔ معمولی هرگز شناسهٔ تلگرام، آیدی، نام، نام خانوادگی، زبان یا پروفایل فرستنده را نمی‌بیند.\n` +
    `• ربات برای کارکرد پاسخ‌ها و مدیریت تخلف، شناسهٔ فرستنده و گیرنده را داخلی ذخیره می‌کند؛ این داده به کاربران معمولی نشان داده نمی‌شود.\n` +
    `• <b>ابرمدیر</b> (فقط یک حساب) می‌تواند همهٔ کاربران، پیام‌ها، هویت‌ها، پاسخ‌ها، گزارش‌ها، مسدودی‌ها و لاگ‌های حسابرسی را ببیند.\n` +
    `• یک حساب <b>دارای دسترسی هویتی</b> فقط برای پیام‌های ناشناسی که خطاب به خودش شده می‌تواند هویت فرستنده را ببیند؛ دسترسی مدیریتی ندارد و پیام‌های دیگران را نمی‌بیند.\n` +
    `• پس ناشناسی <b>بین کاربران</b> است، نه در برابر مسؤول پلتفرم.\n\n` +
    `پیام‌ها نگهداری می‌شوند. حذف خودکار یا «حذف توسط کاربر» وجود ندارد. لینک‌ها تاریخچه دارند: با /roll لینک باطل می‌شود اما رکوردهای قدیمی می‌مانند.\n\n` +
    `اگر این مدل حریم خصوصی برای شما مناسب نیست، از این ربات برای محتوای حساس استفاده نکنید.`,

  'user.link':
    (p) =>
      `🔗 <b>لینک ناشناس شما</b>\n\n` +
      `<code>${p.link}</code>\n\n` +
      `روی متن لینک بزنید تا کپی شود، یا از دکمهٔ اشتراک‌گذاری استفاده کنید. هرکس این لینک را باز کند می‌تواند ناشناس به شما پیام بدهد.\n\n` +
      `برای باطل کردن این لینک و ساخت لینک جدید، /roll را بزنید.`,

  'user.roll':
    (p) =>
      `♻️ <b>لینک شما عوض شد</b>\n\n` +
      `لینک قبلی از همین لحظه باطل است. هرکس آن را باز کند پیام «لینک دیگر فعال نیست» می‌بیند.\n\n` +
      `لینک جدید:\n<code>${p.link}</code>\n\n` +
      `گفتگوها و پاسخ‌های موجود بی‌تأثیرند. سابقهٔ لینک‌ها برای حسابرسی نگهداری می‌شود.`,

  'user.invalidLink':
    `⚠️ <b>این لینک ناشناس نامعتبر است.</b>\n\n` +
    `ببینید لینک را کامل کپی کرده‌اید یا نه. از صاحب لینک بخواهید دوباره برایتان بفرستد.`,

  'user.inactiveLink':
    `⌛ <b>این لینک ناشناس دیگر فعال نیست.</b>\n\n` +
    `صاحب لینک، لینک جدیدی ساخته است. از او لینک جدید را بگیرید.`,

  'user.suspended':
    `🚫 <b>دسترسی شما معلق شده است.</b>\n\n` +
    `در حال حاضر نمی‌توانید پیام ناشناس بفرستید یا از قابلیت‌های پیام‌رسانی استفاده کنید. اگر فکر می‌کنید اشتباهی رخ داده، به مسؤول پلتفرم پیام بدهید.`,

  'user.paused':
    `⏸ <b>پیام‌رسانی ناشناس موقتاً متوقف شده است</b> (به دست مسؤول پلتفرم). لطفاً بعداً دوباره امتحان کنید.`,

  'user.notInConversation':
    `💬 <b>هیچ گفتگوی ناشناسی انتخاب نشده است.</b>\n\n` +
    `برای شروع، لینک ناشناس کسی را باز کنید. برای پاسخ‌دادن به یک پیام ناشناس، روی خودِ آن پیام از قابلیت <b>Reply</b> تلگرام استفاده کنید — نه روی همین اعلان.\n\n` +
    `برای به اشتراک‌گذاشتن لینک خودتان، /link را بزنید.`,

  'user.replyInstruction':
    `↩️ برای پاسخ ناشناس، روی پیام ناشناس اصلی از قابلیت <b>Reply</b> تلگرام استفاده کنید. ` +
    `پاسخ شما بدون افشای هویت هیچ‌کدام از دو طرف، به فرستنده می‌رسد.`,

  'user.replyUnavailable':
    `⚠️ این پیام جزو گفتگوهای ناشناس نیست، بنابراین جایی امن برای مسیریابی پاسخ وجود ندارد.\n\n` +
    `مستقیم روی خودِ پیام ناشناس Reply کنید. اگر می‌خواهید گفتگوی جدیدی شروع کنید، لینک ناشناس آن شخص را باز کنید.`,

  'user.blockedConversation': `🚫 این گفتگو دیگر در دسترس نیست.`,

  'user.linkError':
    `⚠️ در این لحظه نتوانستم لینک ناشناس شما را بسازم. چند لحظه بعد دوباره /start را بزنید.`,

  'user.languageMenu':
    (p) =>
      `🌐 <b>انتخاب زبان ربات</b>\n\n` +
      `زبان فعلی: <b>${p.current}</b>\n` +
      `یکی از گزینه‌های زیر را انتخاب کنید. انتخاب شما در حساب شما ذخیره می‌شود.`,

  'user.languageSet':
    (p) => `✅ زبان ربات به <b>${p.name}</b> تغییر کرد.`,

  // ------------------------------------------------------------------
  // Rate limits and button answers
  // ------------------------------------------------------------------
  'limits.roll': `⏳ در یک ساعت گذشته بیش از حد لینک خود را عوض کرده‌اید. لطفاً کمی بعد دوباره امتحان کنید.`,
  'limits.send': `⏳ پیام‌ها را بیش از حد سریع می‌فرستید. لطفاً یک دقیقه صبر کنید.`,
  'limits.command': `⏳ دستورهای زیادی فرستاده‌اید. لطفاً کمی صبر کنید.`,
  'user.unknownCommand': `دستور ناشناخته است. برای دیدن نحوهٔ کار پیام‌رسانی ناشناس، /help را بزنید.`,

  'cb.noAction': 'این دکمه کاری انجام نمی‌دهد.',
  'cb.accountError': 'حساب شما بارگذاری نشد.',
  'cb.notAvailableHere': 'این دکمه اینجا در دسترس نیست.',
  'cb.notAvailable': 'این دکمه در دسترس نیست.',
  'cb.noLongerAvailable': 'این دکمه دیگر در دسترس نیست.',
  'cb.notAvailableToYou': 'این دکمه برای شما قابل استفاده نیست.',
  'cb.genericError': 'خطایی رخ داد. لطفاً دوباره امتحان کنید.',
  'cb.suspended': 'دسترسی شما معلق است.',
  'cb.linkSent': 'لینک ارسال شد.',
  'cb.helpSent': 'راهنما ارسال شد.',
  'cb.privacySent': 'مدل حریم خصوصی ارسال شد.',
  'cb.replyHelpSent': 'راهنمای پاسخ ارسال شد.',
  'cb.chooseReason': 'دلیل را انتخاب کنید.',
  'cb.invalidReason': 'دلیل گزارش نامعتبر است.',
  'cb.alreadyReported': 'این پیام را قبلاً گزارش کرده‌اید.',
  'cb.reportSubmitted': 'گزارش ثبت شد.',
  'cb.reportMenuTitle': 'دلیل گزارش را انتخاب کنید',
  'cb.alreadyBlocked': 'این فرستنده قبلاً مسدود شده است.',
  'cb.cannotBlockSelf': 'نمی‌توانید خودتان را مسدود کنید.',
  'cb.blockedAlert': '🚫 مسدود شد. این فرستنده دیگر نمی‌تواند به شما پیام ناشناس بدهد.',
  'cb.revealDenied': 'افشای هویت برای این حساب مجاز نیست.',
  'cb.senderMissing': 'رکورد فرستنده در دسترس نیست.',
  'cb.identitySent': 'هویت فرستنده ارسال شد.',
  'cb.langUpdated': 'زبان ذخیره شد.',

  // ------------------------------------------------------------------
  // Report flow
  // ------------------------------------------------------------------
  'report.menu':
    `🚩 <b>این پیام ناشناس گزارش شود؟</b>\n\n` +
    `گزارش همراه با خود پیام برای مسؤول پلتفرم ارسال می‌شود. فرستنده نمی‌فهمد چه‌کسی او را گزارش کرده است.\n\n` +
    `دلیل را انتخاب کنید:`,
  'report.submitted':
    (p) =>
      `✅ <b>گزارش ثبت شد</b>\n\n` +
      `دلیل: ${p.reason}\n` +
      `مسؤول پلتفرم آن را بررسی خواهد کرد.`,
  'report.reasonSpam': 'هرزنامه یا تبلیغ',
  'report.reasonAbuse': 'آزار و اذیت',
  'report.reasonScam': 'کلاهبرداری',
  'report.reasonOther': 'سایر',
  'report.notProvided': 'ذکر نشده',
  'report.superadminNotice':
    (p) =>
      `🚩 <b>گزارش جدید پیام ناشناس</b>\n\n` +
      `گزارش #${p.reportId}\n` +
      `دلیل: <b>${p.reason}</b>\n` +
      `پیام: #${p.messageId} · ${p.type} · ${p.createdAt}\n` +
      `محتوا: ${p.content}\n` +
      `پیوست‌ها: ${p.attachments}\n\n` +
      `<b>گزارش‌دهنده</b>\n${p.reporter}\n\n` +
      `<b>فرستندهٔ گزارش‌شده</b>\n${p.sender}\n\n` +
      `<b>گیرنده</b>\n${p.recipient}`,

  // ------------------------------------------------------------------
  // Block flow
  // ------------------------------------------------------------------
  'block.confirmText':
    `🚫 <b>فرستنده مسدود شد.</b> این شخص دیگر نمی‌تواند به شما پیام ناشناس بدهد یا این گفتگو را ادامه دهد.`,

  // ------------------------------------------------------------------
  // Identity reveal
  // ------------------------------------------------------------------
  'reveal.scope.superadmin': 'افشای سراسری (ابرمدیر)',
  'reveal.scope.privileged':
    'افشای هویتی ویژه: این پیام خطاب به شما بوده است',
  'reveal.scope.authorized': 'افشای مجاز',
  'reveal.title':
    (p) =>
      `🔎 <b>هویت فرستنده</b>\n` +
      `<i>${p.scope}</i>\n\n` +
      `<b>نام نمایشی:</b> ${p.name}\n` +
      `<b>نام:</b> ${p.firstName}\n` +
      `<b>نام خانوادگی:</b> ${p.lastName}\n` +
      `<b>آیدی:</b> ${p.username}\n` +
      `<b>شناسهٔ تلگرام:</b> <code>${p.tgId}</code>\n` +
      `<b>زبان کلاینت:</b> ${p.languageCode}\n\n` +
      `<b>پیام:</b> #${p.messageId} · ${p.messageType}\n` +
      `<b>زمان ارسال:</b> ${p.createdAt}\n` +
      `<b>وضعیت:</b> ${p.status}\n` +
      `<b>محتوا:</b> ${p.content}\n` +
      `<b>پیوست‌ها:</b> ${p.attachments}\n\n` +
      `این افشا محرمانه است و فقط شامل همین پیام است.`,
  'reveal.notAvailable': 'در دسترس نیست',

  // ------------------------------------------------------------------
  // Delivery confirmations and failures
  // ------------------------------------------------------------------
  'delivery.confirmed': `✅ ناشناس تحویل شد. گیرنده می‌تواند با Reply تلگرام پاسخ بدهد.`,
  'delivery.albumDone': (p) =>
    `✅ ناشناس تحویل شد — ${p.countText} آیتم آلبوم.`,
  'delivery.albumPartial': (p) =>
    `⚠️ ${p.successText} از ${p.totalText} آیتم آلبوم تحویل شد. برخی آیتم‌ها از سوی تلگرام رد شدند.`,
  'delivery.albumControl':
    (p) =>
      `📎 <b>آلبوم ناشناس</b> · ${p.countText} آیتم\n` +
      `رسانهٔ بالا ناشناس تحویل شد.\n` +
      `برای پاسخ ناشناس، روی همین پیام (یا هر آیتم بالای آن) Reply کنید.`,
  'delivery.fail.protected':
    `❌ این پیام توسط تلگرام محافظت‌شده است و نمی‌توان آن را ناشناس بازفرست کرد.`,
  'delivery.fail.unreachable':
    `❌ تحویل نشد: گیرنده برای ربات قابل دسترسی نیست. احتمالاً ربات را بلاک کرده است.`,
  'delivery.fail.refused':
    `❌ تلگرام از بازفرست این پیام خودداری کرد. ممکن است محافظت‌شده، منقضی‌شده یا پشتیبانی‌نشده باشد.`,
  'delivery.fail.limited':
    `❌ تحویل به دلیل محدودیت نرخ تلگرام انجام نشد. چند لحظه بعد دوباره امتحان کنید.`,
  'delivery.fail.generic': `❌ پیام تحویل نشد. لطفاً دوباره امتحان کنید.`,
  'delivery.unsupported.service':
    `❌ پیام‌های سیستمی تلگرام (عضویت، سنجاق، تغییرات گروه) را نمی‌توان ناشناس فرستاد.`,
  'delivery.unsupported.payment':
    `❌ پیام‌های پرداخت و فاکتور را نمی‌توان ناشناس کپی کرد.`,
  'delivery.unsupported.story':
    `❌ استوری‌ها را ربات نمی‌تواند کپی کند. لطفاً عکس یا ویدیو را مستقیم بفرستید.`,
  'delivery.unsupported.giveaway':
    `❌ پیام‌های چیدمان جایزه را نمی‌توان ناشناس کپی کرد.`,
  'delivery.unsupported.generic':
    `❌ این نوع پیام با Bot API تلگرام قابل بازفرست نیست. متن، رسانه، مخاطب، موقعیت مکانی یا نظرسنجی امتحان کنید.`,
  'delivery.unsupported.albumProtected':
    `❌ این آلبوم محتوای محافظت‌شده دارد و نمی‌توان آن را ناشناس بازفرست کرد.`,
  'delivery.unsupported.albumGeneric':
    `❌ آلبوم تحویل نشد. احتمالاً تلگرام اجازهٔ کپی یکی از آیتم‌هایش را نمی‌دهد.`,
  'delivery.unsupported.quizNoAnswer':
    `❌ این نظرسنجی کوئیز قابل کپی نیست، چون پاسخ صحیح برای ربات نمایان نیست.`,

  // ------------------------------------------------------------------
  // Buttons (user)
  // ------------------------------------------------------------------
  'btn.reply': '↩️ پاسخ',
  'btn.report': '🚩 گزارش',
  'btn.blockSender': '🚫 مسدود کردن فرستنده',
  'btn.revealSender': '🔎 افشای هویت فرستنده',
  'btn.reasonSpam': 'هرزنامه',
  'btn.reasonAbuse': 'آزار و اذیت',
  'btn.reasonScam': 'کلاهبرداری',
  'btn.reasonOther': 'سایر',
  'btn.myLink': '🔗 لینک ناشناس من',
  'btn.howReplies': '↩️ نحوهٔ پاسخ‌دادن',
  'btn.privacy': '🔐 حریم خصوصی',
  'btn.shareMyLink': '📤 اشتراک‌گذاری لینک من',
  'btn.howItWorks': '❓ نحوهٔ کار',
  'btn.backToHelp': '« بازگشت به راهنما',
  'btn.langFa': '🇮🇷 فارسی',
  'btn.langEn': '🇬🇧 English',

  // ------------------------------------------------------------------
  // Message type labels
  // ------------------------------------------------------------------
  'type.text': 'متن',
  'type.photo': 'عکس',
  'type.video': 'ویدیو',
  'type.voice': 'پیام صوتی',
  'type.video_note': 'ویدیو یادداشت',
  'type.audio': 'فایل صوتی',
  'type.document': 'فایل',
  'type.sticker': 'استیکر',
  'type.animation': 'انیمیشن (گیف)',
  'type.contact': 'مخاطب',
  'type.location': 'موقعیت مکانی',
  'type.venue': 'مکان',
  'type.poll': 'نظرسنجی',
  'type.dice': 'تاس',
  'type.game': 'بازی',
  'type.album': 'آلبوم رسانه‌ای',
  'type.unsupported': 'پشتیبانی‌نشده',
  'type.mediaMessage': 'پیام رسانه‌ای',
  'type.albumItem': 'آیتم آلبوم',
  'type.control': '(پیام مدیریتی)',

  // ------------------------------------------------------------------
  // Status labels
  // ------------------------------------------------------------------
  'status.delivered': 'تحویل‌شده',
  'status.failed': 'ناموفق',
  'status.delivering': 'در حال تحویل',
  'status.pending': 'در انتظار',
  'status.pending_album': 'آلبوم در صف',
  'status.open': 'باز',
  'status.reviewed': 'بررسی‌شده',
  'status.all': 'همه',
  'status.enabled': 'فعال',
  'status.paused': 'متوقف',
  'status.active': 'فعال',
  'status.notBanned': 'مسدود نیست',
  'status.banned': 'مسدود شده',

  // ------------------------------------------------------------------
  // Admin texts
  // ------------------------------------------------------------------
  'admin.dashboard':
    (p) =>
      `🛡 <b>پلتفرم ناشناس · داشبورد مدیریت</b>\n\n` +
      `👥 <b>کاربران:</b> ${p.totalUsers} · <b>جدیدِ امروز:</b> ${p.newUsersToday}\n` +
      `💬 <b>پیام‌ها:</b> ${p.totalMessages} · <b>امروز:</b> ${p.messagesToday}\n` +
      `↩️ <b>پاسخ‌ها:</b> ${p.totalReplies}\n` +
      `🚩 <b>گزارش‌ها:</b> ${p.totalReports} · <b>باز:</b> ${p.openReports}\n` +
      `⛔ <b>مسدودشده‌ها:</b> ${p.totalBanned} · <b>مسدودسازی‌ها:</b> ${p.totalBlocks}\n` +
      `🔗 <b>لینک‌های فعال:</b> ${p.activeLinks}\n` +
      `⚠️ <b>تحویل‌های ناموفق:</b> ${p.failedMessages}\n\n` +
      `🆕 <b>کاربران اخیر</b>\n${p.recentUsers}\n\n` +
      `💬 <b>پیام‌های اخیر</b>\n${p.recentMessages}\n\n` +
      `🚩 <b>گزارش‌های اخیر</b>\n${p.recentReports}`,
  'admin.empty': '<i>هیچ موردی نیست</i>',
  'admin.noUsersPage': '<i>در این صفحه کاربری نیست.</i>',
  'admin.noMessages': '<i>پیامی نیست.</i>',
  'admin.noFilterMatch': '<i>پیامی با این فیلتر یافت نشد.</i>',
  'admin.noBlocks': '<i>رابطهٔ مسدودسازی‌ای نیست.</i>',
  'admin.noReports': '<i>گزارشی نیست.</i>',
  'admin.noAudit': '<i>موردی در لاگ حسابرسی نیست.</i>',
  'admin.noReason': 'بدون دلیل',

  'admin.users':
    (p) =>
      `👥 <b>کاربران</b> · ${p.page}\n` +
      `مجموع: ${p.total}\n\n` +
      p.rows,
  'admin.userJoined': 'عضویت',
  'admin.userDetail':
    (p) =>
      `👤 <b>کاربر #${p.id}</b>\n\n` +
      `<b>نام:</b> ${p.name}\n` +
      `<b>آیدی:</b> ${p.username}\n` +
      `<b>شناسهٔ تلگرام:</b> <code>${p.tgId}</code>\n` +
      `<b>زبان کلاینت:</b> ${p.languageCode}\n` +
      `<b>زبان ربات:</b> ${p.uiLanguage}\n` +
      `<b>ثبت‌نام:</b> ${p.createdAt}\n` +
      `<b>آخرین فعالیت:</b> ${p.lastActiveAt}\n\n` +
      `🔗 <b>توکن لینک فعال:</b> ${p.activeLink}\n` +
      `📚 <b>رکوردهای تاریخی لینک:</b> ${p.linkCount}\n\n` +
      `📨 <b>پیام‌های ارسالی:</b> ${p.sent} · <b>دریافتی:</b> ${p.received}\n` +
      `↩️ <b>گفتگوهای آغازشده:</b> ${p.conversationsStarted} · <b>مالک:</b> ${p.conversationsOwned}\n` +
      `🚩 <b>گزارش‌های ثبت‌شده:</b> ${p.reportsFiled} · <b>علیه او:</b> ${p.reportsAgainst}\n` +
      `🚫 <b>مسدودسازی‌های او:</b> ${p.blocksMade} · <b>علیه او:</b> ${p.blocksReceived}\n\n` +
      p.banSection +
      `\n<i>زمینهٔ صفحه: ${p.page}</i>`,
  'admin.banSection.active': (p) =>
    `⛔ <b>مسدودی:</b> فعال\nدلیل: ${p.reason}\nاز تاریخ: ${p.since}\n`,
  'admin.banSection.none': `✅ <b>مسدودی:</b> ندارد\n`,

  'admin.userMessages':
    (p) =>
      `📨 <b>پیام‌ها · ${p.name}</b> (${p.direction})\n` +
      `${p.page} · مجموع ${p.total}\n\n` +
      p.rows,
  'admin.direction.sent': 'ارسالی',
  'admin.direction.received': 'دریافتی',
  'admin.direction.all': 'همه',

  'admin.blocks':
    (p) =>
      `🚫 <b>روابط مسدودسازی · ${p.name}</b>\n\n` +
      `مجموع: ${p.total}${p.showing}\n\n` +
      p.rows,
  'admin.blockLine': (p) => `#${p.id} · ${p.blocker} مسدود کرد ${p.blocked} · ${p.date}`,
  'admin.blockRelationships': '🚫 <b>روابط مسدودسازی</b>\n\n',

  'admin.messages':
    (p) =>
      `💬 <b>مرور سراسری پیام‌ها</b>\n` +
      `${p.page} · مجموع ${p.total}\n` +
      `<i>${p.filter}</i>\n\n` +
      p.rows,

  'admin.messageListLine':
    (p) =>
      `#${p.id} · <b>${p.type}</b> · ${p.status}\n` +
      `${p.sender} → ${p.recipient} · ${p.date}\n` +
      `«${p.content}»`,

  'admin.messageDetail':
    (p) =>
      `💬 <b>پیام #${p.id}</b>\n\n` +
      `<b>نوع:</b> ${p.type}${p.albumNote}\n` +
      `<b>وضعیت:</b> ${p.status}${p.errorNote}\n` +
      `<b>زمان ساخت:</b> ${p.createdAt}\n` +
      `<b>تحویل:</b> ${p.deliveredAt}\n` +
      `<b>گفتگو:</b> #${p.conversationId} · والد #${p.parentId} · ریشه #${p.rootId}\n\n` +
      `<b>فرستنده</b>\n${p.sender}\n\n` +
      `<b>گیرنده</b>\n${p.recipient}\n\n` +
      `<b>محتوا</b>\n${p.content}\n\n` +
      `<b>پیوست‌ها</b>\n${p.attachments}\n\n` +
      `<b>ارجاع‌های تلگرام</b>\n` +
      `چت مبدأ <code>${p.sourceChat}</code> · پیام مبدأ <code>${p.sourceMessage}</code>\n` +
      `چت تحویل <code>${p.deliveredChat}</code> · پیام تحویل <code>${p.deliveredMessage}</code>\n` +
      `توکن عمومی <code>${p.publicToken}</code>\n\n` +
      `<b>مسیرها</b>\n${p.routes}\n\n` +
      `<b>گزارش‌ها:</b> ${p.reports}`,
  'admin.routeLine': (p) =>
    `• چت <code>${p.chatId}</code> → پیام <code>${p.messageId}</code>${p.control}`,
  'admin.attachmentLine': (p) =>
    `• ${p.index}. ${p.type}${p.dims}${p.duration}${p.fileName}\n` +
    `   <code>${p.fileId}</code>${p.meta}`,
  'admin.noFileId': 'بدون شناسه فایل',

  'admin.conversation':
    (p) =>
      `🧵 <b>گفتگو #${p.id}</b>\n` +
      `آغازگر #${p.initiatorId} · مالک #${p.ownerId}\n` +
      `مجموع پیام‌ها: ${p.total}${p.showing}\n\n` +
      p.rows,
  'admin.showingLast': (p) => ` · نمایش ${p.count} مورد آخر`,

  'admin.reports':
    (p) =>
      `🚩 <b>گزارش‌ها</b> · ${p.status} · ${p.page}\n\n` +
      p.rows,
  'admin.reportLine':
    (p) =>
      `#${p.id} · <b>${p.status}</b> · ${p.reason}\n` +
      `پیام #${p.messageId} · گزارش‌دهنده ${p.reporter} → فرستنده ${p.sender}\n` +
      `${p.date}`,
  'admin.reportDetail':
    (p) =>
      `🚩 <b>گزارش #${p.id}</b>\n\n` +
      `<b>وضعیت:</b> ${p.status}\n` +
      `<b>دلیل:</b> ${p.reason}\n` +
      `<b>ثبت‌شده:</b> ${p.createdAt}\n` +
      `<b>بررسی‌شده:</b> ${p.reviewedAt} توسط ${p.reviewedBy}\n\n` +
      `<b>گزارش‌دهنده</b>\n${p.reporter}\n\n` +
      `<b>فرستندهٔ گزارش‌شده</b>\n${p.sender}\n\n` +
      `<b>گیرنده</b>\n${p.recipient}\n\n` +
      `<b>پیام #${p.messageId}</b> · ${p.messageType}\n` +
      `«${p.content}»\n` +
      `پیوست‌ها: ${p.attachments}`,
  'admin.missingMessage': 'ناموجود',

  'admin.auditLog':
    (p) =>
      `📋 <b>لاگ حسابرسی مدیریتی</b> · ${p.page}\n\n` +
      p.rows,
  'admin.auditLine':
    (p) =>
      `#${p.id} · <b>${p.action}</b>\n` +
      `کنشگر <code>${p.actor}</code> · هدف ${p.targetType} ${p.targetId}\n` +
      `${p.date}${p.meta}`,

  'admin.settings':
    (p) =>
      `⚙️ <b>تنظیمات پلتفرم</b>\n\n` +
      `<b>پیام‌رسانی ناشناس:</b> ${p.messaging}\n` +
      `<b>ابرمدیر:</b> <code>${p.superadmin}</code> <i>(ثابت)</i>\n` +
      `<b>دارای دسترسی هویتی:</b> <code>${p.privileged}</code> <i>(ثابت)</i>\n` +
      `<b>آیدی ربات:</b> @${p.botUsername}\n` +
      `<b>نسخهٔ فهرست دستورها:</b> <code>${p.commandsVersion}</code>\n` +
      `<b>آخرین همگام‌سازی دستورها:</b> ${p.syncedAt}\n` +
      `<b>آخرین خطای دستورها:</b> ${p.commandsError}\n\n` +
      `نقش‌ها را نمی‌توان از طریق ربات ارتقا داد یا تغییر داد. حساب ابرمدیر و حساب دارای دسترسی هویتی، ثابت‌های کد هستند.`,

  'admin.search':
    (p) =>
      `🔎 <b>جستجو:</b> ${p.query}\n\n` +
      `<b>کاربران</b>\n${p.users}\n\n` +
      `<b>پیام‌ها</b>\n${p.messages}`,

  'admin.confirmBan':
    (p) =>
      `⛔ <b>این کاربر مسدود شود؟</b>\n\n` +
      `${p.identity}\n\n` +
      `او دیگر نمی‌تواند پیام ناشناس بفرستد یا پاسخ بدهد. رکوردهای موجودش باقی می‌ماند. این عمل با /unban قابل بازگشت است.`,

  'admin.confirmRoll':
    (p) =>
      `♻️ <b>لینک این کاربر دوباره ساخته شود؟</b>\n\n` +
      `${p.identity}\n\n` +
      `لینک فعلی بلافاصله باطل می‌شود. گفتگوهای موجود سرِ جایشان می‌مانند و رکوردهای تاریخی لینک باقی می‌ماند.`,

  'admin.broadcastPreview':
    (p) =>
      `📣 <b>پیش‌نمایش همگانی</b>\n\n` +
      `<b>گیرندگان:</b> ${p.recipients}\n` +
      `<b>نوع:</b> ${p.type}\n` +
      `<b>محتوا:</b> ${p.content}\n\n` +
      `محتوایی که در بالا دیدید، دقیقاً همان چیزی است که برای هر کاربر کپی می‌شود. ` +
      `برای شروع <b>تأیید و ارسال</b> را بزنید. تحویل دسته‌ای و ردیابی‌شده است؛ سطر یکتای تحویل از تکرار جلوگیری می‌کند.`,

  'admin.broadcastProgress':
    (p) =>
      `📣 <b>همگانی #${p.id}</b>\n\n` +
      `<b>وضعیت:</b> ${p.status}\n` +
      `<b>گیرندگان:</b> ${p.total}\n` +
      `<b>ارسال‌شده:</b> ${p.sent}\n` +
      `<b>ناموفق:</b> ${p.failed}\n` +
      `<b>در انتظار:</b> ${p.pending}\n` +
      `<b>باقی‌مانده:</b> ${p.remaining}\n\n` +
      p.note,
  'admin.broadcastNote.stopped': `همگانی متوقف شد. تحویل‌های انجام‌شده ثبت مانده‌اند.`,
  'admin.broadcastNote.continue':
    `سقف هر دسته، ربات را از محدودیت نرخ تلگرام محافظت می‌کند. برای دستهٔ بعدی «ادامه» را بزنید.`,
  'admin.broadcastNote.done': `ارسال همگانی کامل شد.`,

  'admin.broadcastMenu':
    `📣 <b>ارسال همگانی</b>\n\n` +
    `با /broadcast یا دکمهٔ زیر وارد حالت نوشتن شوید. از شما خواسته می‌شود متن دقیق اطلاعیه را بفرستید. ` +
    `متن، عکس، ویدیو، فایل و دیگر رسانه‌های تک‌پیام پشتیبانی می‌شود. آلبوم برای ارسال همگانی پشتیبانی نمی‌شود.\n\n` +
    `هر کاربر ثبت‌شده گیرنده است. موفقیت و شکست تحویل برای هر کاربر ردیابی می‌شود.`,

  'admin.exportMenu':
    `📤 <b>خروجی گرفتن رکوردهای پلتفرم</b>\n\n` +
    `قالب را انتخاب کنید. فایل‌ها در حافظه ساخته و به‌صورت سند تلگرام ارسال می‌شوند. هیچ وابستگی به فایل‌سیستم وجود ندارد.\n\n` +
    `JSON همهٔ جدول‌های عملیاتی را دارد (سقف ۲۰٬۰۰۰ سطر در هر جدول). CSV دو فایل جداگانهٔ کاربران و پیام‌ها می‌سازد.`,

  'admin.exportCaptionJson':
    (p) =>
      `📤 <b>خروجی JSON</b>\n${p.size} · ${p.rows} سطر${p.truncated}`,
  'admin.exportTruncatedList': 'جدول‌های بریده‌شده',
  'admin.exportCaptionUsers':
    (p) => `📊 <b>CSV کاربران</b>\n${p.rows} سطر${p.truncated}`,
  'admin.exportCaptionMessages':
    (p) => `📊 <b>CSV پیام‌ها</b>\n${p.rows} سطر${p.truncated}`,
  'admin.exportTruncated': (p) => ` (بریده‌شده)`,
  'admin.exportFailed': (p) => `❌ خروجی گرفتن ناموفق بود: ${p.message}`,
  'admin.exportSendFailed': `❌ فایل خروجی ارسال نشد.`,

  'admin.composePrompt':
    `✍️ <b>حالت نوشتن ارسال همگانی</b>\n\n` +
    `پیام دقیقی که می‌خواهید به همه اطلاع داده شود را بفرستید. می‌تواند متن، عکس، ویدیو، فایل، ویس، فایل صوتی، استیکر، انیمیشن، مخاطب، موقعیت مکانی، مکان یا نظرسنجی باشد.\n\n` +
    `آلبوم برای ارسال همگانی پشتیبانی نمی‌شود؛ فقط پیام‌های تکی.\n\n` +
    `پیش‌نمایشی با «تأیید/لغو» خواهید دید. تا تأیید نکنید چیزی ارسال نمی‌شود.`,
  'admin.composeAlbumUnsupported':
    `⚠️ آلبوم برای ارسال همگانی پشتیبانی نمی‌شود. حالت نوشتن بسته شد. از /broadcast استفاده کنید و یک پیام بفرستید.`,
  'admin.composeProtected':
    `⚠️ این پیام توسط تلگرام محافظت‌شده است و نمی‌توان آن را همگانی فرستاد. یک پیام بدون حفاظت بفرستید.`,

  'admin.composePromptPhoto': `✍️ <b>عکس همگانی دریافت شد</b> — زیرنویس دلخواه را بفرستید یا «تأیید» را بزنید.`,

  'admin.filter.type': (p) => `نوع: ${p.value}`,
  'admin.filter.days': (p) => `بازه: ${p.value}`,
  'admin.filter.sender': (p) => `شناسهٔ داخلی فرستنده: ${p.value}`,
  'admin.filter.recipient': (p) => `شناسهٔ داخلی گیرنده: ${p.value}`,
  'admin.filter.all': 'همه',
  'admin.filter.typeName': (p) => p.value,

  'admin.identityBlock':
    (p) =>
      `${p.name}\n` +
      `TG <code>${p.tgId}</code> · ${p.username}\n` +
      `زبان ${p.languageCode} · ثبت‌نام ${p.createdAt} · آخرین فعالیت ${p.lastActiveAt}`,
  'admin.shortUser': (p) => `${p.name} <code>${p.tgId}</code>`,
  'admin.unknownUser': '<i>نامشخص</i>',

  // ------------------------------------------------------------------
  // Admin keyboard labels
  // ------------------------------------------------------------------
  'adm.btn.users': '👥 کاربران',
  'adm.btn.messages': '💬 پیام‌ها',
  'adm.btn.reports': '🚩 گزارش‌ها',
  'adm.btn.broadcast': '📣 ارسال همگانی',
  'adm.btn.settings': '⚙️ تنظیمات',
  'adm.btn.audit': '📋 لاگ حسابرسی',
  'adm.btn.export': '📤 خروجی',
  'adm.btn.search': '🔎 جستجو',
  'adm.btn.sync': '🔄 همگام‌سازی دستورها',
  'adm.btn.close': '✖️ بستن',
  'adm.btn.dashboard': '🏠 داشبورد',
  'adm.btn.prev': '« قبلی',
  'adm.btn.next': 'بعدی »',
  'adm.btn.sent': '📤 ارسالی',
  'adm.btn.received': '📥 دریافتی',
  'adm.btn.allMessages': '📨 همهٔ پیام‌ها',
  'adm.btn.blocks': '🚫 مسدودی‌ها',
  'adm.btn.ban': '⛔ مسدود',
  'adm.btn.unban': '✅ رفع مسدودی',
  'adm.btn.superadminProtected': '🛡 ابرمدیر (محافظت‌شده)',
  'adm.btn.regenerateLink': '♻️ ساخت دوباره لینک',
  'adm.btn.usersBack': '« کاربران',
  'adm.btn.userBack': '« کاربر',
  'adm.btn.messageBack': '« پیام',
  'adm.btn.messagesBack': '« پیام‌ها',
  'adm.btn.reportsBack': '« گزارش‌ها',
  'adm.btn.broadcastBack': '« همگانی',
  'adm.btn.parent': (p) => `↩️ والد #${p.id}`,
  'adm.btn.conversation': (p) => `🧵 گفتگو #${p.id}`,
  'adm.btn.sender': '👤 فرستنده',
  'adm.btn.recipient': '👤 گیرنده',
  'adm.btn.banSender': '⛔ مسدود کردن فرستنده',
  'adm.btn.report': (p) => `🚩 گزارش #${p.id}`,
  'adm.btn.allTypes': 'همهٔ انواع',
  'adm.btn.text': 'متن',
  'adm.btn.media': 'رسانه',
  'adm.btn.failed': 'ناموفق',
  'adm.btn.today': 'امروز',
  'adm.btn.days7': '۷ روز',
  'adm.btn.days30': '۳۰ روز',
  'adm.btn.clearDates': 'بدون بازه',
  'adm.btn.open': 'باز',
  'adm.btn.reviewed': 'بررسی‌شده',
  'adm.btn.statusAll': 'همه',
  'adm.btn.markReviewed': '✅ علامت بررسی‌شده',
  'adm.btn.openMessage': '💬 باز کردن پیام',
  'adm.btn.pauseMessaging': '⏸ توقف پیام‌رسانی',
  'adm.btn.enableMessaging': '▶️ فعال‌سازی پیام‌رسانی',
  'adm.btn.exportJson': '📄 JSON (همهٔ جدول‌ها)',
  'adm.btn.exportCsv': '📊 CSV (کاربران + پیام‌ها)',
  'adm.btn.compose': '✍️ نوشتن ارسال همگانی',
  'adm.btn.confirmSend': '✅ تأیید و ارسال',
  'adm.btn.cancel': 'لغو',
  'adm.btn.continueBatch': '▶️ ادامهٔ دستهٔ بعدی',
  'adm.btn.stopBroadcast': '⏹ توقف ارسال',
  'adm.btn.confirmBan': '⛔ تأیید مسدودی',
  'adm.btn.confirmRotation': '♻️ تأیید تعویض لینک',

  // ------------------------------------------------------------------
  // Admin callback answers
  // ------------------------------------------------------------------
  'adm.cb.dashboard': 'داشبورد',
  'adm.cb.closed': 'بسته شد',
  'adm.cb.adminPanelClosed': '🔒 <b>پنل مدیریت بسته شد.</b>',
  'adm.cb.usersPage': (p) => `کاربران ${p.page}`,
  'adm.cb.messages': 'پیام‌ها',
  'adm.cb.conversationNotFound': 'گفتگو یافت نشد.',
  'adm.cb.conversation': 'گفتگو',
  'adm.cb.reports': 'گزارش‌ها',
  'adm.cb.auditLog': 'لاگ حسابرسی',
  'adm.cb.settings': 'تنظیمات',
  'adm.cb.export': 'خروجی',
  'adm.cb.generatingJson': 'در حال ساخت خروجی JSON…',
  'adm.cb.generatingCsv': 'در حال ساخت خروجی CSV…',
  'adm.cb.broadcast': 'ارسال همگانی',
  'adm.cb.sendBroadcastContent': 'محتوای همگانی را بفرستید.',
  'adm.cb.composeCancelled': 'نوشتن لغو شد.',
  'adm.cb.searchHint':
    `🔎 از <code>/search &lt;query&gt;</code> استفاده کنید. کوئری عددی دقیقاً با شناسهٔ تلگرام و کلی با متن پیام مطابقت داده می‌شود؛ کوئری متنی با آیدی، نام‌ها و محتوای پیام‌ها چک می‌شود.`,
  'adm.cb.noAction': 'بدون کنش.',
  'adm.cb.unknownAction': 'کنش مدیریتی ناشناخته.',
  'adm.cb.actionFailed': 'کنش مدیریتی ناموفق بود. لاگ‌ها را بررسی کنید.',
  'adm.cb.userNotFound': 'کاربر یافت نشد.',
  'adm.cb.user': 'کاربر',
  'adm.cb.userMessages': 'پیام‌های کاربر',
  'adm.cb.blocks': 'مسدودی‌ها',
  'adm.cb.alreadyBanned': 'کاربر قبلاً مسدود شده است.',
  'adm.cb.confirmBan': 'تأیید مسدودی',
  'adm.cb.superadminCannotBan': 'ابرمدیر را نمی‌توان مسدود کرد.',
  'adm.cb.userBanned': 'کاربر مسدود شد.',
  'adm.cb.userUnbanned': 'مسدودی کاربر رفع شد.',
  'adm.cb.confirmRotation': 'تأیید تعویض لینک',
  'adm.cb.linkRegenerated': 'لینک دوباره ساخته شد.',
  'adm.cb.messageNotFound': 'پیام یافت نشد.',
  'adm.cb.message': 'پیام',
  'adm.cb.reportNotFound': 'گزارش یافت نشد.',
  'adm.cb.report': 'گزارش',
  'adm.cb.reportReviewed': 'گزارش بررسی شد.',
  'adm.cb.reportAlreadyReviewed': 'گزارش قبلاً بررسی شده بود.',
  'adm.cb.unknownSetting': 'تنظیم ناشناخته.',
  'adm.cb.messagingPaused': 'پیام‌رسانی متوقف شد.',
  'adm.cb.messagingEnabled': 'پیام‌رسانی فعال شد.',
  'adm.cb.syncing': 'در حال همگام‌سازی دستورها…',
  'adm.cb.syncIncomplete': (p) => `⚠️ همگام‌سازی دستورها ناقص بود:\n${p.errors}`,
  'adm.cb.broadcastNotFound': 'ارسال همگانی یافت نشد.',
  'adm.cb.processingBatch': 'در حال پردازش دسته…',
  'adm.cb.broadcastNotRunning': 'ارسال همگانی در حال اجرا نیست.',
  'adm.cb.broadcastStopped': 'ارسال همگانی متوقف شد.',

  // ------------------------------------------------------------------
  // Admin command replies
  // ------------------------------------------------------------------
  'adm.cmd.notAvailable': 'این دستور در دسترس نیست.',
  'adm.cmd.unknown': 'دستور مدیریتی ناشناخته.',
  'adm.cmd.usageUser': (p) => `شیوهٔ استفاده: <code>/user &lt;${p.arg}&gt;</code>`,
  'adm.cmd.usageMessage': (p) => `شیوهٔ استفاده: <code>/message &lt;${p.arg}&gt;</code>`,
  'adm.cmd.usageSearch': (p) => `شیوهٔ استفاده: <code>/search &lt;${p.arg}&gt;</code>`,
  'adm.cmd.usageBan': (p) =>
    `شیوهٔ استفاده: <code>/ban &lt;${p.arg}&gt; [دلیل]</code>`,
  'adm.cmd.usageUnban': (p) => `شیوهٔ استفاده: <code>/unban &lt;${p.arg}&gt;</code>`,
  'adm.cmd.noUser': (p) => `کاربر ثبت‌شده‌ای با شناسهٔ تلگرام <code>${p.id}</code> وجود ندارد.`,
  'adm.cmd.noMessage': (p) => `پیامی با شناسهٔ داخلی <code>${p.id}</code> وجود ندارد.`,
  'adm.cmd.noSuchSender': 'فیلتر فرستنده: چنین شناسهٔ تلگرام ثبت‌شده‌ای وجود ندارد.',
  'adm.cmd.noSuchRecipient': 'فیلتر گیرنده: چنین شناسهٔ تلگرام ثبت‌شده‌ای وجود ندارد.',
  'adm.cmd.superadminCannotBan': 'ابرمدیر را نمی‌توان مسدود کرد.',
  'adm.cmd.banned': (p) => `⛔ کاربر <code>${p.id}</code> مسدود شد.`,
  'adm.cmd.unbanned': (p) => `✅ مسدودی کاربر <code>${p.id}</code> رفع شد.`,
  'adm.cmd.notBanned': 'این کاربر مسدود نیست.',
  'adm.notify.banned':
    `🚫 دسترسی شما به پیام‌رسانی ناشناس توسط مسؤول پلتفرم معلق شد.`,
  'adm.notify.unbanned': `✅ دسترسی شما به پیام‌رسانی ناشناس بازگردانده شد.`,
  'adm.notify.linkRegenerated':
    `♻️ لینک ناشناس شما توسط مسؤول پلتفرم دوباره ساخته شد. برای دیدن لینک جدید /link را بزنید. گفتگوهای موجود بی‌تأثیرند.`,

  // ------------------------------------------------------------------
  // Broadcast notices to users
  // ------------------------------------------------------------------
  'broadcast.userNotice':
    (p) =>
      `📣 <b>اطلاعیهٔ مسؤول پلتفرم</b>\n\n` +
      p.content,

  // ------------------------------------------------------------------
  // Command descriptions (Persian)
  // ------------------------------------------------------------------
  'cmd.start': 'شروع ربات و دریافت لینک ناشناس شما',
  'cmd.help': 'راهنمای پیام‌رسانی ناشناس',
  'cmd.link': 'نمایش لینک ناشناس شخصی شما',
  'cmd.roll': 'ساخت لینک ناشناس جدید',
  'cmd.about': 'دربارهٔ پلتفرم و مدل حریم خصوصی',
  'cmd.language': 'تغییر زبان ربات',
  'cmd.admin': 'باز کردن داشبورد مدیریت',
  'cmd.stats': 'مشاهدهٔ آمار پلتفرم',
  'cmd.users': 'مرور کاربران ثبت‌شده',
  'cmd.user': 'بررسی کاربر با شناسهٔ تلگرام',
  'cmd.messages': 'مرور همهٔ پیام‌ها',
  'cmd.message': 'بررسی پیام با شناسهٔ داخلی',
  'cmd.search': 'جستجوی کاربران و پیام‌ها',
  'cmd.reports': 'بررسی گزارش‌های کاربران',
  'cmd.ban': 'مسدود کردن کاربر با شناسهٔ تلگرام',
  'cmd.unban': 'رفع مسدودی کاربر با شناسهٔ تلگرام',
  'cmd.broadcast': 'ارسال اطلاعیه به همهٔ کاربران',
  'cmd.export': 'خروجی رکوردهای پلتفرم به‌صورت JSON یا CSV',

  // ------------------------------------------------------------------
  // Misc
  // ------------------------------------------------------------------
  'misc.shareFallback': 'برایم پیام ناشناس بفرست:',
  'misc.timestampUTC': 'UTC',
};
