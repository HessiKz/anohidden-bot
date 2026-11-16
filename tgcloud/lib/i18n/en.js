// English catalog — secondary language, selectable with /language.
// Must keep key parity with fa.js; a test enforces this.

export const en = {
  'common.backToHelp': '« Back to help',
  'common.back': '« Back',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.confirm': 'Confirm',
  'common.continue': 'Continue',
  'common.unknown': 'Unknown',
  'common.none': 'none',
  'common.never': 'never',
  'common.yes': 'yes',
  'common.no': 'no',
  'common.page': 'page',
  'common.total': 'total',

  'user.onboarding':
    (p) =>
      `👋 <b>Welcome to anonymous messaging</b>\n\n` +
      `Your personal anonymous link:\n<code>${p.link}</code>\n\n` +
      `Share this link with anyone. When they open it and send a message, you receive it here without seeing their name, username, or numeric ID.\n\n` +
      `<b>How to answer</b>\n` +
      `Use Telegram’s <b>Reply</b> on the anonymous message. The bot routes your reply back to the sender. They can reply to your reply, and the conversation continues — both sides stay anonymous.\n\n` +
      `<b>Your controls</b>\n` +
      `• /link — show this link\n` +
      `• /roll — revoke it and create a new one\n` +
      `• /language — change the bot language\n` +
      `• /help — how it works\n\n` +
      `You have <b>one active link</b>. Rolling it immediately invalidates the old link, but existing conversations keep working.`,

  'user.target.self':
    `🙂 <b>That is your own link.</b>\n\n` +
    `Share it with someone else so they can message you anonymously. Use /link to copy it.`,

  'user.target.unavailable': `⚠️ This anonymous link is currently unavailable.`,

  'user.target.body':
    `🕶 <b>Anonymous message mode</b>\n\n` +
    `Send the message you want to deliver. Text, photos, videos, voice notes, documents, stickers, albums, contacts, locations, venues, and polls are supported.\n\n` +
    `Your name, username, and numeric ID will not be shown to the recipient. Replies happen through Telegram’s Reply feature.\n\n` +
    `You can send more than one message during this session. Open a link again to start another anonymous conversation.`,

  'user.help':
    (p) =>
      `🕶 <b>How anonymous messaging works</b>\n\n` +
      `<b>1. Share your link</b>\n` +
      `Every user has one active link: <code>${p.link}</code>. Use /link to see yours.\n\n` +
      `<b>2. Receive anonymously</b>\n` +
      `When someone opens your link, they can send you text, media, albums, contacts, locations, venues, and polls. You see the content — never their identity.\n\n` +
      `<b>3. Reply with Telegram’s Reply</b>\n` +
      `Reply directly to the anonymous message. The bot looks up the delivery route from the Telegram message you replied to. Do not use the Reply button as a wizard; it only reminds you how native replies work.\n\n` +
      `<b>4. Controls</b>\n` +
      `• <b>Report</b> — the message is submitted for review.\n` +
      `• <b>Block</b> stops that sender from contacting you again.\n` +
      `• /roll replaces your link immediately; old conversations still work.\n\n` +
      (p.isSuperadmin
        ? `You are the superadmin. Use /admin for the administration dashboard.`
        : `Use /about for the full privacy model.`),

  'user.privacy':
    `🔐 <b>Privacy model</b>\n\n` +
    `• Ordinary recipients never see a sender’s Telegram ID, username, first name, last name, language, or profile.\n` +
    `• The bot stores sender and recipient IDs internally so replies and moderation work. This data is not shown to ordinary users.\n` +
    `• The <b>superadmin</b> (exactly one account) can inspect all users, messages, identities, replies, reports, blocks, and audit logs.\n` +
    `• A separate <b>identity-privileged</b> account can reveal the sender identity only for anonymous messages addressed to that account. It has no administrative access and cannot inspect anyone else’s messages.\n` +
    `• Anonymity is therefore <b>between users</b>, not against the platform operator.\n\n` +
    `Messages are retained. There is no user-facing delete or auto-purge. Links are historical: rolling a link revokes it but preserves old records.\n\n` +
    `If this is not the privacy model you need, do not use the bot for sensitive content.`,

  'user.link':
    (p) =>
      `🔗 <b>Your anonymous link</b>\n\n` +
      `<code>${p.link}</code>\n\n` +
      `Tap the link text to copy it, or use the Share button below. Anyone who opens it can send you an anonymous message.\n\n` +
      `Use /roll to revoke this link and generate a new one.`,

  'user.roll':
    (p) =>
      `♻️ <b>Your link has been rotated</b>\n\n` +
      `The previous link is invalid immediately. Anyone who tries it will get a friendly “link no longer active” message.\n\n` +
      `New link:\n<code>${p.link}</code>\n\n` +
      `Existing conversations and replies are unaffected. Historical link records are retained for auditing.`,

  'user.invalidLink':
    `⚠️ <b>This anonymous link is invalid.</b>\n\n` +
    `Check that you copied the complete link. Ask the owner to send it again.`,

  'user.inactiveLink':
    `⌛ <b>This anonymous link is no longer active.</b>\n\n` +
    `The owner generated a new link. Ask them for the current one.`,

  'user.suspended':
    `🚫 <b>Your access is suspended.</b>\n\n` +
    `You cannot send anonymous messages or use messaging features right now. Contact the platform operator if you believe this is a mistake.`,

  'user.paused':
    `⏸ <b>Anonymous messaging is temporarily paused</b> by the platform operator. Please try again later.`,

  'user.notInConversation':
    `💬 <b>No anonymous conversation is selected.</b>\n\n` +
    `To start one, open someone’s anonymous link. To answer an anonymous message, use Telegram’s <b>Reply</b> directly on that message — not on this notice.\n\n` +
    `Use /link to share your own link.`,

  'user.replyInstruction':
    `↩️ To reply anonymously, simply use Telegram’s <b>Reply</b> feature on the original anonymous message. ` +
    `Your reply will be routed back to the sender without revealing either identity.`,

  'user.replyUnavailable':
    `⚠️ That message is not an anonymous conversation message, so there is nowhere safe to route a reply.\n\n` +
    `Reply directly to the anonymous message itself. If you are trying to start a new conversation, open the person’s anonymous link.`,

  'user.blockedConversation': `🚫 This conversation is no longer available.`,

  'user.linkError':
    `⚠️ I could not create your anonymous link right now. Please try /start again in a moment.`,

  'user.languageMenu':
    (p) =>
      `🌐 <b>Choose the bot language</b>\n\n` +
      `Current language: <b>${p.current}</b>\n` +
      `Pick one of the options below. Your choice is stored on your account.`,

  'user.languageSet': (p) => `✅ Bot language set to <b>${p.name}</b>.`,

  'limits.roll': `⏳ You have rotated your link too many times in the last hour. Please try again later.`,
  'limits.send': `⏳ You are sending messages too quickly. Please wait a minute.`,
  'limits.command': `⏳ Too many commands. Please wait a moment.`,
  'user.unknownCommand': `Unknown command. Use /help to see how anonymous messaging works.`,

  'cb.noAction': 'This button has no action.',
  'cb.accountError': 'Your account could not be loaded.',
  'cb.notAvailableHere': 'This button is not available here.',
  'cb.notAvailable': 'This button is not available.',
  'cb.noLongerAvailable': 'This button is no longer available.',
  'cb.notAvailableToYou': 'This button is not available to you.',
  'cb.genericError': 'Something went wrong. Please try again.',
  'cb.suspended': 'Your access is suspended.',
  'cb.linkSent': 'Link sent.',
  'cb.helpSent': 'Help sent.',
  'cb.privacySent': 'Privacy model sent.',
  'cb.replyHelpSent': 'Reply instructions sent.',
  'cb.chooseReason': 'Choose a reason.',
  'cb.invalidReason': 'Invalid report reason.',
  'cb.alreadyReported': 'You already reported this message.',
  'cb.reportSubmitted': 'Report submitted.',
  'cb.reportMenuTitle': 'Choose a report reason',
  'cb.alreadyBlocked': 'This sender is already blocked.',
  'cb.cannotBlockSelf': 'You cannot block yourself.',
  'cb.blockedAlert': '🚫 Blocked. This sender can no longer message you.',
  'cb.revealDenied': 'Identity disclosure is not authorized for this account.',
  'cb.senderMissing': 'The sender record is unavailable.',
  'cb.identitySent': 'Sender identity sent.',
  'cb.langUpdated': 'Language saved.',

  'report.menu':
    `🚩 <b>Report this anonymous message?</b>\n\n` +
    `The report goes to the platform operator together with the message. The sender is not told who reported them.\n\n` +
    `Choose a reason:`,
  'report.submitted':
    (p) =>
      `✅ <b>Report submitted</b>\n\n` +
      `Reason: ${p.reason}\n` +
      `The platform operator will review it.`,
  'report.reasonSpam': 'Spam or advertising',
  'report.reasonAbuse': 'Harassment or abuse',
  'report.reasonScam': 'Scam or fraud',
  'report.reasonOther': 'Other',
  'report.notProvided': 'Not provided',
  'report.superadminNotice':
    (p) =>
      `🚩 <b>New anonymous message report</b>\n\n` +
      `Report #${p.reportId}\n` +
      `Reason: <b>${p.reason}</b>\n` +
      `Message: #${p.messageId} · ${p.type} · ${p.createdAt}\n` +
      `Content: ${p.content}\n` +
      `Attachments: ${p.attachments}\n\n` +
      `<b>Reporter</b>\n${p.reporter}\n\n` +
      `<b>Reported sender</b>\n${p.sender}\n\n` +
      `<b>Recipient</b>\n${p.recipient}`,

  'block.confirmText':
    `🚫 <b>Sender blocked.</b> This person can no longer send you anonymous messages or continue this conversation.`,

  'reveal.scope.superadmin': 'Superadmin global disclosure',
  'reveal.scope.privileged':
    'Identity-privileged disclosure: this message was addressed to you',
  'reveal.scope.authorized': 'Authorized disclosure',
  'reveal.title':
    (p) =>
      `🔎 <b>Sender identity</b>\n` +
      `<i>${p.scope}</i>\n\n` +
      `<b>Display name:</b> ${p.name}\n` +
      `<b>First name:</b> ${p.firstName}\n` +
      `<b>Last name:</b> ${p.lastName}\n` +
      `<b>Username:</b> ${p.username}\n` +
      `<b>Telegram ID:</b> <code>${p.tgId}</code>\n` +
      `<b>Client language:</b> ${p.languageCode}\n\n` +
      `<b>Message:</b> #${p.messageId} · ${p.messageType}\n` +
      `<b>Sent:</b> ${p.createdAt}\n` +
      `<b>Status:</b> ${p.status}\n` +
      `<b>Content:</b> ${p.content}\n` +
      `<b>Attachments:</b> ${p.attachments}\n\n` +
      `This disclosure is confidential and scoped to this message.`,
  'reveal.notAvailable': 'not available',

  'delivery.confirmed': `✅ Delivered anonymously. The recipient can reply with Telegram’s Reply feature.`,
  'delivery.albumDone': (p) =>
    `✅ Delivered anonymously — ${p.countText} album item${p.count === 1 ? '' : 's'}.`,
  'delivery.albumPartial': (p) =>
    `⚠️ Delivered ${p.successText} of ${p.totalText} album items. Some items were refused by Telegram.`,
  'delivery.albumControl':
    (p) =>
      `📎 <b>Anonymous album</b> · ${p.count} item${p.count === 1 ? '' : 's'}\n` +
      `The media above was delivered anonymously.\n` +
      `Use Telegram's Reply on this message (or on any item above) to answer anonymously.`,
  'delivery.fail.protected':
    `❌ This message is protected by Telegram and cannot be mirrored anonymously.`,
  'delivery.fail.unreachable':
    `❌ Could not deliver: the recipient is not reachable by the bot. They may have blocked it.`,
  'delivery.fail.refused':
    `❌ Telegram refused to mirror this message. It may be protected, expired, or unsupported.`,
  'delivery.fail.limited':
    `❌ Delivery was rate-limited by Telegram. Please try again in a moment.`,
  'delivery.fail.generic': `❌ The message could not be delivered. Please try again.`,
  'delivery.unsupported.service':
    `❌ Telegram service messages (joins, pins, chat changes) cannot be sent anonymously.`,
  'delivery.unsupported.payment':
    `❌ Payment and invoice messages cannot be copied anonymously.`,
  'delivery.unsupported.story':
    `❌ Stories cannot be copied by bots. Please send the photo or video directly.`,
  'delivery.unsupported.giveaway':
    `❌ Giveaway messages cannot be copied anonymously.`,
  'delivery.unsupported.generic':
    `❌ This message type cannot be mirrored by the Telegram Bot API. Try text, media, a contact, a location, or a poll.`,
  'delivery.unsupported.albumProtected':
    `❌ This album contains protected content and cannot be mirrored anonymously.`,
  'delivery.unsupported.albumGeneric':
    `❌ The album could not be delivered. Telegram may not allow copying one of its items.`,
  'delivery.unsupported.quizNoAnswer':
    `❌ This quiz poll cannot be copied because its correct answer is not visible to the bot.`,

  'btn.reply': '↩️ Reply',
  'btn.report': '🚩 Report',
  'btn.blockSender': '🚫 Block sender',
  'btn.revealSender': '🔎 Reveal sender identity',
  'btn.reasonSpam': 'Spam',
  'btn.reasonAbuse': 'Abuse',
  'btn.reasonScam': 'Scam',
  'btn.reasonOther': 'Other',
  'btn.myLink': '🔗 My anonymous link',
  'btn.howReplies': '↩️ How replies work',
  'btn.privacy': '🔐 Privacy',
  'btn.shareMyLink': '📤 Share my link',
  'btn.howItWorks': '❓ How it works',
  'btn.backToHelp': '« Back to help',
  'btn.langFa': '🇮🇷 فارسی',
  'btn.langEn': '🇬🇧 English',

  'type.text': 'Text',
  'type.photo': 'Photo',
  'type.video': 'Video',
  'type.voice': 'Voice message',
  'type.video_note': 'Video note',
  'type.audio': 'Audio',
  'type.document': 'Document',
  'type.sticker': 'Sticker',
  'type.animation': 'Animation',
  'type.contact': 'Contact',
  'type.location': 'Location',
  'type.venue': 'Venue',
  'type.poll': 'Poll',
  'type.dice': 'Dice',
  'type.game': 'Game',
  'type.album': 'Media album',
  'type.unsupported': 'Unsupported',
  'type.mediaMessage': 'media message',
  'type.albumItem': 'album item',
  'type.control': ' (control)',

  'status.delivered': 'delivered',
  'status.failed': 'failed',
  'status.delivering': 'delivering',
  'status.pending': 'pending',
  'status.pending_album': 'queued album',
  'status.open': 'open',
  'status.reviewed': 'reviewed',
  'status.all': 'all',
  'status.enabled': 'enabled',
  'status.paused': 'paused',
  'status.active': 'active',
  'status.notBanned': 'no',
  'status.banned': 'banned',

  'admin.dashboard':
    (p) =>
      `🛡 <b>Anonymous platform · Admin dashboard</b>\n\n` +
      `👥 <b>Users:</b> ${p.totalUsers} · <b>new today:</b> ${p.newUsersToday}\n` +
      `💬 <b>Messages:</b> ${p.totalMessages} · <b>today:</b> ${p.messagesToday}\n` +
      `↩️ <b>Replies:</b> ${p.totalReplies}\n` +
      `🚩 <b>Reports:</b> ${p.totalReports} · <b>open:</b> ${p.openReports}\n` +
      `⛔ <b>Banned:</b> ${p.totalBanned} · <b>blocks:</b> ${p.totalBlocks}\n` +
      `🔗 <b>Active links:</b> ${p.activeLinks}\n` +
      `⚠️ <b>Failed deliveries:</b> ${p.failedMessages}\n\n` +
      `🆕 <b>Recent users</b>\n${p.recentUsers}\n\n` +
      `💬 <b>Recent messages</b>\n${p.recentMessages}\n\n` +
      `🚩 <b>Recent reports</b>\n${p.recentReports}`,
  'admin.empty': '<i>none</i>',
  'admin.noUsersPage': '<i>No users on this page.</i>',
  'admin.noMessages': '<i>No messages.</i>',
  'admin.noFilterMatch': '<i>No messages match this filter.</i>',
  'admin.noBlocks': '<i>No block relationships.</i>',
  'admin.noReports': '<i>No reports.</i>',
  'admin.noAudit': '<i>No audit entries.</i>',
  'admin.noReason': 'no reason',

  'admin.users':
    (p) =>
      `👥 <b>Users</b> · ${p.page}\n` +
      `Total: ${p.total}\n\n` +
      p.rows,
  'admin.userJoined': 'joined',
  'admin.userDetail':
    (p) =>
      `👤 <b>User #${p.id}</b>\n\n` +
      `<b>Name:</b> ${p.name}\n` +
      `<b>Username:</b> ${p.username}\n` +
      `<b>Telegram ID:</b> <code>${p.tgId}</code>\n` +
      `<b>Client language:</b> ${p.languageCode}\n` +
      `<b>Bot language:</b> ${p.uiLanguage}\n` +
      `<b>Registered:</b> ${p.createdAt}\n` +
      `<b>Last active:</b> ${p.lastActiveAt}\n\n` +
      `🔗 <b>Active link token:</b> ${p.activeLink}\n` +
      `📚 <b>Historical link records:</b> ${p.linkCount}\n\n` +
      `📨 <b>Messages sent:</b> ${p.sent} · <b>received:</b> ${p.received}\n` +
      `↩️ <b>Conversations started:</b> ${p.conversationsStarted} · <b>owned:</b> ${p.conversationsOwned}\n` +
      `🚩 <b>Reports filed:</b> ${p.reportsFiled} · <b>against:</b> ${p.reportsAgainst}\n` +
      `🚫 <b>Blocks made:</b> ${p.blocksMade} · <b>received:</b> ${p.blocksReceived}\n\n` +
      p.banSection +
      `\n<i>Page context: ${p.page}</i>`,
  'admin.banSection.active': (p) =>
    `⛔ <b>Banned:</b> active\nReason: ${p.reason}\nSince: ${p.since}\n`,
  'admin.banSection.none': `✅ <b>Banned:</b> no\n`,

  'admin.userMessages':
    (p) =>
      `📨 <b>Messages · ${p.name}</b> (${p.direction})\n` +
      `${p.page} · total ${p.total}\n\n` +
      p.rows,
  'admin.direction.sent': 'sent',
  'admin.direction.received': 'received',
  'admin.direction.all': 'all',

  'admin.blocks':
    (p) =>
      `🚫 <b>Block relationships · ${p.name}</b>\n\n` +
      `Total: ${p.total}${p.showing}\n\n` +
      p.rows,
  'admin.blockLine': (p) => `#${p.id} · ${p.blocker} blocked ${p.blocked} · ${p.date}`,
  'admin.blockRelationships': '🚫 <b>Block relationships</b>\n\n',

  'admin.messages':
    (p) =>
      `💬 <b>Global message explorer</b>\n` +
      `${p.page} · total ${p.total}\n` +
      `<i>${p.filter}</i>\n\n` +
      p.rows,

  'admin.messageListLine':
    (p) =>
      `#${p.id} · <b>${p.type}</b> · ${p.status}\n` +
      `${p.sender} → ${p.recipient} · ${p.date}\n` +
      `“${p.content}”`,

  'admin.messageDetail':
    (p) =>
      `💬 <b>Message #${p.id}</b>\n\n` +
      `<b>Type:</b> ${p.type}${p.albumNote}\n` +
      `<b>Status:</b> ${p.status}${p.errorNote}\n` +
      `<b>Created:</b> ${p.createdAt}\n` +
      `<b>Delivered:</b> ${p.deliveredAt}\n` +
      `<b>Conversation:</b> #${p.conversationId} · parent #${p.parentId} · root #${p.rootId}\n\n` +
      `<b>Sender</b>\n${p.sender}\n\n` +
      `<b>Recipient</b>\n${p.recipient}\n\n` +
      `<b>Content</b>\n${p.content}\n\n` +
      `<b>Attachments</b>\n${p.attachments}\n\n` +
      `<b>Telegram references</b>\n` +
      `source chat <code>${p.sourceChat}</code> · source msg <code>${p.sourceMessage}</code>\n` +
      `delivered chat <code>${p.deliveredChat}</code> · delivered msg <code>${p.deliveredMessage}</code>\n` +
      `public token <code>${p.publicToken}</code>\n\n` +
      `<b>Routes</b>\n${p.routes}\n\n` +
      `<b>Reports:</b> ${p.reports}`,
  'admin.routeLine': (p) =>
    `• chat <code>${p.chatId}</code> → msg <code>${p.messageId}</code>${p.control}`,
  'admin.attachmentLine': (p) =>
    `• ${p.index}. ${p.type}${p.dims}${p.duration}${p.fileName}\n` +
    `   <code>${p.fileId}</code>${p.meta}`,
  'admin.noFileId': 'no file id',

  'admin.conversation':
    (p) =>
      `🧵 <b>Conversation #${p.id}</b>\n` +
      `Initiator #${p.initiatorId} · owner #${p.ownerId}\n` +
      `Total messages: ${p.total}${p.showing}\n\n` +
      p.rows,
  'admin.showingLast': (p) => ` · showing last ${p.count}`,

  'admin.reports':
    (p) =>
      `🚩 <b>Reports</b> · ${p.status} · ${p.page}\n\n` +
      p.rows,
  'admin.reportLine':
    (p) =>
      `#${p.id} · <b>${p.status}</b> · ${p.reason}\n` +
      `message #${p.messageId} · reporter ${p.reporter} → sender ${p.sender}\n` +
      `${p.date}`,
  'admin.reportDetail':
    (p) =>
      `🚩 <b>Report #${p.id}</b>\n\n` +
      `<b>Status:</b> ${p.status}\n` +
      `<b>Reason:</b> ${p.reason}\n` +
      `<b>Created:</b> ${p.createdAt}\n` +
      `<b>Reviewed:</b> ${p.reviewedAt} by ${p.reviewedBy}\n\n` +
      `<b>Reporter</b>\n${p.reporter}\n\n` +
      `<b>Reported sender</b>\n${p.sender}\n\n` +
      `<b>Recipient</b>\n${p.recipient}\n\n` +
      `<b>Message #${p.messageId}</b> · ${p.messageType}\n` +
      `“${p.content}”\n` +
      `Attachments: ${p.attachments}`,
  'admin.missingMessage': 'missing',

  'admin.auditLog':
    (p) =>
      `📋 <b>Administrative audit log</b> · ${p.page}\n\n` +
      p.rows,
  'admin.auditLine':
    (p) =>
      `#${p.id} · <b>${p.action}</b>\n` +
      `actor <code>${p.actor}</code> · target ${p.targetType} ${p.targetId}\n` +
      `${p.date}${p.meta}`,

  'admin.settings':
    (p) =>
      `⚙️ <b>Platform settings</b>\n\n` +
      `<b>Anonymous messaging:</b> ${p.messaging}\n` +
      `<b>Superadmin:</b> <code>${p.superadmin}</code> <i>(immutable)</i>\n` +
      `<b>Identity-privileged:</b> <code>${p.privileged}</code> <i>(immutable)</i>\n` +
      `<b>Bot username:</b> @${p.botUsername}\n` +
      `<b>Command registry:</b> <code>${p.commandsVersion}</code>\n` +
      `<b>Commands synced at:</b> ${p.syncedAt}\n` +
      `<b>Last command error:</b> ${p.commandsError}\n\n` +
      `Roles cannot be promoted or changed from the bot. The superadmin and identity-privileged accounts are code constants.`,

  'admin.search':
    (p) =>
      `🔎 <b>Search:</b> ${p.query}\n\n` +
      `<b>Users</b>\n${p.users}\n\n` +
      `<b>Messages</b>\n${p.messages}`,

  'admin.confirmBan':
    (p) =>
      `⛔ <b>Ban this user?</b>\n\n` +
      `${p.identity}\n\n` +
      `They will be unable to send anonymous messages or replies. Their existing records are retained. This is reversible with /unban.`,

  'admin.confirmRoll':
    (p) =>
      `♻️ <b>Regenerate this user’s link?</b>\n\n` +
      `${p.identity}\n\n` +
      `The current link becomes invalid immediately. Existing conversations keep working. Historical link records are retained.`,

  'admin.broadcastPreview':
    (p) =>
      `📣 <b>Broadcast preview</b>\n\n` +
      `<b>Recipients:</b> ${p.recipients}\n` +
      `<b>Type:</b> ${p.type}\n` +
      `<b>Content:</b> ${p.content}\n\n` +
      `The message you sent above is the exact content that will be copied to each user. ` +
      `Press <b>Confirm and send</b> to start. Delivery is batched and tracked; duplicates are prevented by a unique delivery row.`,

  'admin.broadcastProgress':
    (p) =>
      `📣 <b>Broadcast #${p.id}</b>\n\n` +
      `<b>Status:</b> ${p.status}\n` +
      `<b>Recipients:</b> ${p.total}\n` +
      `<b>Sent:</b> ${p.sent}\n` +
      `<b>Failed:</b> ${p.failed}\n` +
      `<b>Pending:</b> ${p.pending}\n` +
      `<b>Remaining:</b> ${p.remaining}\n\n` +
      p.note,
  'admin.broadcastNote.stopped': `Broadcast stopped. Already-sent deliveries remain recorded.`,
  'admin.broadcastNote.continue':
    `The batch limit protects the bot from Telegram rate limits. Press Continue to process the next batch.`,
  'admin.broadcastNote.done': `Broadcast complete.`,

  'admin.broadcastMenu':
    `📣 <b>Broadcast</b>\n\n` +
    `Use /broadcast or the button below to enter compose mode. You will be asked to send the exact message to announce. ` +
    `Text, photos, videos, documents, and other single-message media are supported. Albums are not supported for broadcasts.\n\n` +
    `Every registered user is a recipient. Delivery success and failure are tracked per user.`,

  'admin.exportMenu':
    `📤 <b>Export platform records</b>\n\n` +
    `Choose a format. Files are generated in memory and sent as Telegram documents. There is no filesystem dependency.\n\n` +
    `JSON contains every operational table (capped at 20,000 rows per table). CSV produces separate users and messages files.`,

  'admin.exportCaptionJson':
    (p) =>
      `📤 <b>JSON export</b>\n${p.size} · ${p.rows} rows${p.truncated}`,
  'admin.exportTruncatedList': 'Truncated',
  'admin.exportCaptionUsers':
    (p) => `📊 <b>Users CSV</b>\n${p.rows} rows${p.truncated}`,
  'admin.exportCaptionMessages':
    (p) => `📊 <b>Messages CSV</b>\n${p.rows} rows${p.truncated}`,
  'admin.exportTruncated': () => ` (truncated)`,
  'admin.exportFailed': (p) => `❌ Export failed: ${p.message}`,
  'admin.exportSendFailed': `❌ The export file could not be sent.`,

  'admin.composePrompt':
    `✍️ <b>Broadcast compose mode</b>\n\n` +
    `Send the exact message you want to announce. It can be text, a photo, video, document, voice note, audio, sticker, animation, contact, location, venue, or poll.\n\n` +
    `Albums are not supported for broadcasts. Single messages only.\n\n` +
    `You will see a preview with Confirm/Cancel. Nothing is sent until you confirm.`,
  'admin.composeAlbumUnsupported':
    `⚠️ Albums are not supported for broadcasts. Compose mode is closed. Use /broadcast and send one message.`,
  'admin.composeProtected':
    `⚠️ This message is protected by Telegram and cannot be broadcast. Send an unprotected message.`,

  'admin.composePromptPhoto': `✍️ <b>Broadcast photo received</b> — send a caption, or press Confirm.`,

  'admin.filter.type': (p) => `type: ${p.value}`,
  'admin.filter.days': (p) => `days: ${p.value}`,
  'admin.filter.sender': (p) => `sender internal id: ${p.value}`,
  'admin.filter.recipient': (p) => `recipient internal id: ${p.value}`,
  'admin.filter.all': 'all',
  'admin.filter.typeName': (p) => p.value,

  'admin.identityBlock':
    (p) =>
      `${p.name}\n` +
      `TG <code>${p.tgId}</code> · ${p.username}\n` +
      `lang ${p.languageCode} · registered ${p.createdAt} · last active ${p.lastActiveAt}`,
  'admin.shortUser': (p) => `${p.name} <code>${p.tgId}</code>`,
  'admin.unknownUser': '<i>unknown</i>',

  'adm.btn.users': '👥 Users',
  'adm.btn.messages': '💬 Messages',
  'adm.btn.reports': '🚩 Reports',
  'adm.btn.broadcast': '📣 Broadcast',
  'adm.btn.settings': '⚙️ Settings',
  'adm.btn.audit': '📋 Audit log',
  'adm.btn.export': '📤 Export',
  'adm.btn.search': '🔎 Search',
  'adm.btn.sync': '🔄 Sync commands',
  'adm.btn.close': '✖️ Close',
  'adm.btn.dashboard': '🏠 Dashboard',
  'adm.btn.prev': '« Prev',
  'adm.btn.next': 'Next »',
  'adm.btn.sent': '📤 Sent',
  'adm.btn.received': '📥 Received',
  'adm.btn.allMessages': '📨 All messages',
  'adm.btn.blocks': '🚫 Blocks',
  'adm.btn.ban': '⛔ Ban',
  'adm.btn.unban': '✅ Unban',
  'adm.btn.superadminProtected': '🛡 Superadmin (protected)',
  'adm.btn.regenerateLink': '♻️ Regenerate link',
  'adm.btn.usersBack': '« Users',
  'adm.btn.userBack': '« User',
  'adm.btn.messageBack': '« Message',
  'adm.btn.messagesBack': '« Messages',
  'adm.btn.reportsBack': '« Reports',
  'adm.btn.broadcastBack': '« Broadcast',
  'adm.btn.parent': (p) => `↩️ Parent #${p.id}`,
  'adm.btn.conversation': (p) => `🧵 Conversation #${p.id}`,
  'adm.btn.sender': '👤 Sender',
  'adm.btn.recipient': '👤 Recipient',
  'adm.btn.banSender': '⛔ Ban sender',
  'adm.btn.report': (p) => `🚩 Report #${p.id}`,
  'adm.btn.allTypes': 'All types',
  'adm.btn.text': 'Text',
  'adm.btn.media': 'Media',
  'adm.btn.failed': 'Failed',
  'adm.btn.today': 'Today',
  'adm.btn.days7': '7 days',
  'adm.btn.days30': '30 days',
  'adm.btn.clearDates': 'Clear dates',
  'adm.btn.open': 'Open',
  'adm.btn.reviewed': 'Reviewed',
  'adm.btn.statusAll': 'All',
  'adm.btn.markReviewed': '✅ Mark reviewed',
  'adm.btn.openMessage': '💬 Open message',
  'adm.btn.pauseMessaging': '⏸ Pause messaging',
  'adm.btn.enableMessaging': '▶️ Enable messaging',
  'adm.btn.exportJson': '📄 JSON (all tables)',
  'adm.btn.exportCsv': '📊 CSV (users + messages)',
  'adm.btn.compose': '✍️ Compose broadcast',
  'adm.btn.confirmSend': '✅ Confirm and send',
  'adm.btn.cancel': 'Cancel',
  'adm.btn.continueBatch': '▶️ Continue next batch',
  'adm.btn.stopBroadcast': '⏹ Stop broadcast',
  'adm.btn.confirmBan': '⛔ Confirm ban',
  'adm.btn.confirmRotation': '♻️ Confirm rotation',

  'adm.cb.dashboard': 'Dashboard',
  'adm.cb.closed': 'Closed',
  'adm.cb.adminPanelClosed': '🔒 <b>Admin panel closed.</b>',
  'adm.cb.usersPage': (p) => `Users page ${p.page}`,
  'adm.cb.messages': 'Messages',
  'adm.cb.conversationNotFound': 'Conversation not found.',
  'adm.cb.conversation': 'Conversation',
  'adm.cb.reports': 'Reports',
  'adm.cb.auditLog': 'Audit log',
  'adm.cb.settings': 'Settings',
  'adm.cb.export': 'Export',
  'adm.cb.generatingJson': 'Generating JSON export…',
  'adm.cb.generatingCsv': 'Generating CSV export…',
  'adm.cb.broadcast': 'Broadcast',
  'adm.cb.sendBroadcastContent': 'Send the broadcast content.',
  'adm.cb.composeCancelled': 'Compose cancelled.',
  'adm.cb.searchHint':
    `🔎 Use <code>/search &lt;query&gt;</code>. Numeric queries match a Telegram ID exactly and message text broadly; text queries match usernames, names, and message content.`,
  'adm.cb.noAction': 'No action.',
  'adm.cb.unknownAction': 'Unknown admin action.',
  'adm.cb.actionFailed': 'Admin action failed. Check logs.',
  'adm.cb.userNotFound': 'User not found.',
  'adm.cb.user': 'User',
  'adm.cb.userMessages': 'User messages',
  'adm.cb.blocks': 'Blocks',
  'adm.cb.alreadyBanned': 'User is already banned.',
  'adm.cb.confirmBan': 'Confirm ban',
  'adm.cb.superadminCannotBan': 'The superadmin cannot be banned.',
  'adm.cb.userBanned': 'User banned.',
  'adm.cb.userUnbanned': 'User unbanned.',
  'adm.cb.confirmRotation': 'Confirm link rotation',
  'adm.cb.linkRegenerated': 'Link regenerated.',
  'adm.cb.messageNotFound': 'Message not found.',
  'adm.cb.message': 'Message',
  'adm.cb.reportNotFound': 'Report not found.',
  'adm.cb.report': 'Report',
  'adm.cb.reportReviewed': 'Report reviewed.',
  'adm.cb.reportAlreadyReviewed': 'Report was already reviewed.',
  'adm.cb.unknownSetting': 'Unknown setting.',
  'adm.cb.messagingPaused': 'Messaging paused.',
  'adm.cb.messagingEnabled': 'Messaging enabled.',
  'adm.cb.syncing': 'Syncing commands…',
  'adm.cb.syncIncomplete': (p) => `⚠️ Command sync incomplete:\n${p.errors}`,
  'adm.cb.broadcastNotFound': 'Broadcast not found.',
  'adm.cb.processingBatch': 'Processing batch…',
  'adm.cb.broadcastNotRunning': 'Broadcast is not running.',
  'adm.cb.broadcastStopped': 'Broadcast stopped.',

  'adm.cmd.notAvailable': 'This command is not available.',
  'adm.cmd.unknown': 'Unknown admin command.',
  'adm.cmd.usageUser': (p) => `Usage: <code>/user &lt;${p.arg}&gt;</code>`,
  'adm.cmd.usageMessage': (p) => `Usage: <code>/message &lt;${p.arg}&gt;</code>`,
  'adm.cmd.usageSearch': (p) => `Usage: <code>/search &lt;${p.arg}&gt;</code>`,
  'adm.cmd.usageBan': (p) =>
    `Usage: <code>/ban &lt;${p.arg}&gt; [reason]</code>`,
  'adm.cmd.usageUnban': (p) => `Usage: <code>/unban &lt;${p.arg}&gt;</code>`,
  'adm.cmd.noUser': (p) => `No registered user with Telegram ID <code>${p.id}</code>.`,
  'adm.cmd.noMessage': (p) => `No message with internal ID <code>${p.id}</code>.`,
  'adm.cmd.noSuchSender': 'Sender filter: no such registered Telegram ID.',
  'adm.cmd.noSuchRecipient': 'Recipient filter: no such registered Telegram ID.',
  'adm.cmd.superadminCannotBan': 'The superadmin cannot be banned.',
  'adm.cmd.banned': (p) => `⛔ Banned <code>${p.id}</code>.`,
  'adm.cmd.unbanned': (p) => `✅ Unbanned <code>${p.id}</code>.`,
  'adm.cmd.notBanned': 'That user is not banned.',
  'adm.notify.banned':
    `🚫 Your access to anonymous messaging has been suspended by the platform operator.`,
  'adm.notify.unbanned': `✅ Your access to anonymous messaging has been restored.`,
  'adm.notify.linkRegenerated':
    `♻️ Your anonymous link was regenerated by the platform operator. Use /link to see the new one. Existing conversations are unaffected.`,

  'broadcast.userNotice':
    (p) =>
      `📣 <b>Announcement from the platform operator</b>\n\n` +
      p.content,

  'cmd.start': 'Start the bot and get your anonymous link',
  'cmd.help': 'How anonymous messaging works',
  'cmd.link': 'Show your personal anonymous link',
  'cmd.roll': 'Generate a new anonymous link',
  'cmd.about': 'About the platform and its privacy model',
  'cmd.language': 'Change the bot language',
  'cmd.admin': 'Open the administration dashboard',
  'cmd.stats': 'View platform statistics',
  'cmd.users': 'Browse registered users',
  'cmd.user': 'Inspect a user by Telegram ID',
  'cmd.messages': 'Browse all messages',
  'cmd.message': 'Inspect a message by internal ID',
  'cmd.search': 'Search users and messages',
  'cmd.reports': 'Review user reports',
  'cmd.ban': 'Ban a user by Telegram ID',
  'cmd.unban': 'Unban a user by Telegram ID',
  'cmd.broadcast': 'Send an announcement to all users',
  'cmd.export': 'Export platform records as JSON or CSV',

  'misc.shareFallback': 'Send me an anonymous message:',
  'misc.timestampUTC': 'UTC',
};
