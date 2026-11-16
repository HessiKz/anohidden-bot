// Adversarial integration coverage that complements the existing suites:
// poll fallback, broadcast batching, admin message filters, CSV export
// content, the rate-limit helper, banned recipients, and quiz polls.
//
// This file only reads production code — it never patches it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTest,
  sendStart,
  openLink,
  sendFrom,
  getToken,
  getUser,
  getActiveLink,
  botMessages,
  lastBotMessage,
  lastTextContaining,
  buttons,
  click,
  calls,
  queueFailure,
  rawSqlite,
} from './helpers.mjs';
import { IDENTITY_PRIVILEGED_ID, SUPERADMIN_ID } from '../tgcloud/lib/constants.js';

const ADMIN = SUPERADMIN_ID;

const MEDIA_TYPE_LIST =
  "'photo','video','voice','video_note','audio','document','sticker','animation'," +
  "'contact','location','venue','poll','dice','game'";

/** Inline "open this message" buttons of the admin message explorer. */
function messageRowButtons(chatId, messageId) {
  return buttons(chatId, messageId).filter((b) =>
    String(b.callback_data ?? '').startsWith('adm:md:')
  );
}

/** Internal message ids referenced by the admin message explorer buttons. */
function messageRowIds(chatId, messageId) {
  return messageRowButtons(chatId, messageId).map((b) =>
    Number(String(b.callback_data).split(':')[2])
  );
}

function findBotMessage(chatId, messageId) {
  return botMessages(chatId).find((m) => m.message_id === messageId) ?? null;
}

function rows(sql, ...params) {
  return rawSqlite()
    .prepare(sql)
    .all(...params);
}

function row(sql, ...params) {
  return rawSqlite()
    .prepare(sql)
    .get(...params);
}

/** Register a recipient with a link and a sender who opened that link. */
async function pair(recipient, sender) {
  await sendStart(recipient);
  const token = await getToken(recipient);
  await sendStart(sender);
  await openLink(sender, token);
  return token;
}

function regularPoll(question = 'Q?', options = ['A', 'B']) {
  return {
    id: 'poll-regular',
    question,
    options: options.map((text) => ({ text, voter_count: 0 })),
    is_anonymous: true,
    type: 'regular',
    allows_multiple_answers: false,
  };
}

function quizPoll(question = '2+2?', options = ['4', '5'], correctOptionId = undefined) {
  const poll = {
    id: 'poll-quiz',
    question,
    options: options.map((text) => ({ text, voter_count: 0 })),
    is_anonymous: true,
    type: 'quiz',
    allows_multiple_answers: false,
  };
  if (correctOptionId !== undefined) poll.correct_option_id = correctOptionId;
  return poll;
}

// ---------------------------------------------------------------------------
// 1 + 7. Poll fallback (regular and quiz)
// ---------------------------------------------------------------------------

test('a poll that cannot be copied is re-sent with sendPoll and stays delivered', async () => {
  await setupTest();
  await pair(8101, 8102);

  queueFailure('copyMessage', 400, "Bad Request: message can't be copied");
  await sendFrom(8102, { poll: regularPoll('Q?', ['A', 'B']) });

  const pollCalls = calls('sendPoll');
  assert.equal(pollCalls.length, 1, 'the poll fallback used sendPoll');
  assert.equal(Number(pollCalls[0].params.chat_id), 8101);
  assert.equal(pollCalls[0].params.question, 'Q?');
  assert.deepEqual(pollCalls[0].params.options, ['A', 'B']);
  assert.equal(pollCalls[0].params.type, 'regular');
  assert.equal(pollCalls[0].params.is_anonymous, true);
  assert.equal(pollCalls[0].params.allows_multiple_answers, false);

  const messageRow = row('SELECT * FROM messages ORDER BY id DESC LIMIT 1');
  assert.ok(messageRow, 'the poll was stored');
  assert.equal(messageRow.message_type, 'poll');
  assert.equal(messageRow.delivery_status, 'delivered');
  assert.equal(Number(messageRow.delivered_chat_id), 8101);

  const route = row(
    'SELECT * FROM message_routes WHERE message_id = ? ORDER BY id DESC LIMIT 1',
    messageRow.id
  );
  assert.ok(route, 'a delivery route was written');

  const received = botMessages(8101).find((m) => m.question === 'Q?');
  assert.ok(received, 'the recipient received the poll');
  assert.deepEqual(received.options, ['A', 'B']);

  assert.ok(lastTextContaining(8102, 'ناشناس تحویل شد'), 'sender got a success');
  assert.ok(
    !lastTextContaining(8102, 'تحویل نشد'),
    'sender got no failure notice'
  );
});

test('a quiz poll without a visible correct answer fails honestly', async () => {
  await setupTest();
  await pair(8111, 8112);

  const recipientMessagesBefore = botMessages(8111).length;

  queueFailure('copyMessage', 400, "Bad Request: message can't be copied");
  await sendFrom(8112, { poll: quizPoll('2+2?', ['4', '5']) });

  assert.equal(calls('sendPoll').length, 0, 'no poll was sent without an answer key');

  const messageRow = row('SELECT * FROM messages ORDER BY id DESC LIMIT 1');
  assert.ok(messageRow, 'the attempt was stored');
  assert.equal(messageRow.message_type, 'poll');
  assert.equal(messageRow.delivery_status, 'failed');

  const senderNotice = lastBotMessage(8112);
  assert.ok(senderNotice, 'the sender was told something');
  assert.match(senderNotice.text, /❌/);
  assert.match(
    senderNotice.text,
    /نظرسنجی کوئیز|قابل کپی نیست|پاسخ صحیح/
  );
  assert.ok(
    !lastTextContaining(8112, 'ناشناس تحویل شد'),
    'no false success for the sender'
  );

  const recipientMessages = botMessages(8111);
  assert.equal(
    recipientMessages.length,
    recipientMessagesBefore,
    'the recipient received no new message'
  );
  assert.equal(
    recipientMessages.filter((m) => m.poll !== undefined).length,
    0,
    'the recipient received no poll'
  );
  assert.equal(
    recipientMessages.filter((m) => (m.text ?? m.caption)?.includes('2+2?')).length,
    0,
    'the recipient received nothing'
  );
});

test('a quiz poll with a visible correct answer is re-sent as a quiz', async () => {
  await setupTest();
  await pair(8121, 8122);

  queueFailure('copyMessage', 400, "Bad Request: message can't be copied");
  await sendFrom(8122, { poll: quizPoll('2+2?', ['4', '5'], 0) });

  const pollCalls = calls('sendPoll');
  assert.equal(pollCalls.length, 1, 'the quiz fallback used sendPoll');
  assert.equal(pollCalls[0].params.type, 'quiz');
  assert.equal(pollCalls[0].params.correct_option_id, 0);
  assert.equal(pollCalls[0].params.question, '2+2?');
  assert.deepEqual(pollCalls[0].params.options, ['4', '5']);
  assert.equal(Number(pollCalls[0].params.chat_id), 8121);

  const messageRow = row('SELECT * FROM messages ORDER BY id DESC LIMIT 1');
  assert.equal(messageRow.message_type, 'poll');
  assert.equal(messageRow.delivery_status, 'delivered');
  assert.ok(
    botMessages(8121).some((m) => m.question === '2+2?'),
    'the recipient received the quiz'
  );
  assert.ok(lastTextContaining(8122, 'ناشناس تحویل شد'));
});

// ---------------------------------------------------------------------------
// 2. Broadcast batching
// ---------------------------------------------------------------------------

test('a broadcast is delivered in batches of 20 and continues on demand', async () => {
  await setupTest();
  for (let i = 0; i < 24; i++) await sendStart(8200 + i);
  await sendStart(ADMIN);

  const userCount = row('SELECT count(*) AS n FROM users').n;
  assert.equal(userCount, 25, '24 ordinary users plus the admin');

  await sendFrom(ADMIN, '/broadcast');
  assert.match(lastBotMessage(ADMIN).text, /حالت نوشتن ارسال همگانی/);
  await sendFrom(ADMIN, 'batched announcement');

  const preview = lastBotMessage(ADMIN);
  assert.match(preview.text, /پیش‌نمایش همگانی/);
  const broadcast = row('SELECT * FROM broadcasts ORDER BY id DESC LIMIT 1');
  assert.equal(broadcast.status, 'preview');

  const confirm = buttons(ADMIN, preview.message_id).find((b) =>
    String(b.callback_data ?? '').startsWith('adm:brc:')
  );
  assert.ok(confirm, 'the preview offers a confirm button');

  await click(ADMIN, confirm.callback_data, { messageId: preview.message_id });

  const firstBatch = row(
    'SELECT count(*) AS n FROM broadcast_deliveries WHERE broadcast_id = ?',
    broadcast.id
  ).n;
  assert.equal(firstBatch, 20, 'the first batch is capped at BROADCAST_BATCH_SIZE');

  const afterFirst = row('SELECT * FROM broadcasts WHERE id = ?', broadcast.id);
  assert.equal(afterFirst.status, 'sending', 'the broadcast is still sending');
  assert.equal(afterFirst.sent_count, 20);
  assert.equal(afterFirst.failed_count, 0);

  const progress = findBotMessage(ADMIN, preview.message_id);
  assert.ok(progress, 'the preview message now shows the progress');
  assert.match(progress.text, /<b>وضعیت:<\/b> sending/);
  assert.match(progress.text, /<b>ارسال‌شده:<\/b> ۲۰/);
  assert.match(progress.text, /<b>باقی‌مانده:<\/b> ۵/);

  const continueButton = buttons(ADMIN, preview.message_id).find((b) =>
    String(b.callback_data ?? '').startsWith('adm:brn:')
  );
  assert.ok(continueButton, 'a Continue button exists while recipients remain');

  await click(ADMIN, continueButton.callback_data, { messageId: preview.message_id });

  const total = row(
    'SELECT count(*) AS n FROM broadcast_deliveries WHERE broadcast_id = ?',
    broadcast.id
  ).n;
  assert.equal(total, userCount, 'every user has a delivery row');

  const afterSecond = row('SELECT * FROM broadcasts WHERE id = ?', broadcast.id);
  assert.equal(afterSecond.status, 'completed');
  assert.equal(afterSecond.sent_count, userCount);
  assert.equal(afterSecond.failed_count, 0);
  assert.ok(afterSecond.completed_at, 'the completion time is recorded');

  const missing = row(
    `SELECT count(*) AS n FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM broadcast_deliveries d
        WHERE d.broadcast_id = ? AND d.user_id = u.id
      )`,
    broadcast.id
  ).n;
  assert.equal(missing, 0, 'no user was skipped');

  const duplicates = rows(
    `SELECT user_id, count(*) AS c FROM broadcast_deliveries
      WHERE broadcast_id = ? GROUP BY user_id HAVING c > 1`,
    broadcast.id
  );
  assert.equal(duplicates.length, 0, 'no duplicate delivery rows');

  const sent = row(
    "SELECT count(*) AS n FROM broadcast_deliveries WHERE broadcast_id = ? AND status = 'sent'",
    broadcast.id
  ).n;
  assert.equal(sent, userCount, 'every delivery is marked sent');

  // A second Continue must not duplicate deliveries.
  await click(ADMIN, continueButton.callback_data, { messageId: preview.message_id });
  const afterExtra = row(
    'SELECT count(*) AS n FROM broadcast_deliveries WHERE broadcast_id = ?',
    broadcast.id
  ).n;
  assert.equal(afterExtra, userCount, 're-running the batch creates no duplicates');
  const afterExtraBroadcast = row('SELECT * FROM broadcasts WHERE id = ?', broadcast.id);
  assert.equal(afterExtraBroadcast.sent_count, userCount);
});

// ---------------------------------------------------------------------------
// 3. Admin message filters
// ---------------------------------------------------------------------------

test('the admin message explorer filters by media type and by failure', async () => {
  await setupTest();
  await pair(8301, 8302);

  await sendFrom(8302, 'first plain text');
  await sendFrom(8302, 'second plain text');
  await sendFrom(8302, {
    photo: [{ file_id: 'f1', file_unique_id: 'u1', width: 10, height: 10 }],
    caption: 'photo one',
  });
  await sendFrom(8302, {
    photo: [{ file_id: 'f2', file_unique_id: 'u2', width: 10, height: 10 }],
    caption: 'photo two',
  });

  queueFailure('copyMessage', 403, 'Forbidden: bot was blocked by the user');
  await sendFrom(8302, 'third plain text that fails');

  const total = row('SELECT count(*) AS n FROM messages').n;
  assert.equal(total, 5, 'five stored messages');

  await sendStart(ADMIN);
  await sendFrom(ADMIN, '/messages 1 --type=media --days=7');

  const mediaList = lastBotMessage(ADMIN);
  assert.match(mediaList.text, /مرور سراسری پیام‌ها/);
  assert.match(mediaList.text, /نوع: media/, 'the filter label names the type');
  assert.match(mediaList.text, /بازه: ۷/, 'the filter label names the window');

  const expectedMedia = row(
    `SELECT count(*) AS n FROM messages WHERE message_type IN (${MEDIA_TYPE_LIST})`
  ).n;
  assert.equal(expectedMedia, 2, 'raw SQL agrees on the media count');

  const mediaIds = messageRowIds(ADMIN, mediaList.message_id);
  assert.equal(mediaIds.length, expectedMedia, 'only media rows are listed');
  for (const id of mediaIds) {
    const messageRow = row('SELECT * FROM messages WHERE id = ?', id);
    assert.equal(messageRow.message_type, 'photo');
    assert.equal(messageRow.delivery_status, 'delivered');
  }
  assert.ok(!mediaList.text.includes('first plain text'), 'text rows are filtered out');
  assert.ok(!mediaList.text.includes('third plain text'), 'failed text rows are filtered out');

  await sendFrom(ADMIN, '/messages 1 --type=failed');
  const failedList = lastBotMessage(ADMIN);
  assert.match(failedList.text, /نوع: failed/);

  const expectedFailed = row(
    "SELECT count(*) AS n FROM messages WHERE delivery_status = 'failed'"
  ).n;
  assert.equal(expectedFailed, 1, 'raw SQL agrees on the failed count');

  const failedIds = messageRowIds(ADMIN, failedList.message_id);
  assert.equal(failedIds.length, expectedFailed, 'only failed rows are listed');
  for (const id of failedIds) {
    const messageRow = row('SELECT * FROM messages WHERE id = ?', id);
    assert.equal(messageRow.delivery_status, 'failed');
  }
  assert.ok(failedList.text.includes('third plain text that fails'));
  assert.ok(!failedList.text.includes('first plain text'));

  // An unknown type falls back to "all" instead of erroring out.
  await sendFrom(ADMIN, '/messages 1 --type=bogus');
  const fallbackList = lastBotMessage(ADMIN);
  assert.match(fallbackList.text, /نوع: all/);
  assert.equal(messageRowIds(ADMIN, fallbackList.message_id).length, total);
});

// ---------------------------------------------------------------------------
// 4. CSV export content
// ---------------------------------------------------------------------------

test('the CSV export carries real users and messages rows', async () => {
  await setupTest();
  await pair(8401, 8402);
  await sendFrom(8402, 'csv marker text');

  await sendStart(ADMIN);
  await sendFrom(ADMIN, '/export csv');

  const csvCalls = calls('sendDocument').filter((c) =>
    String(c.params?.document?.filename ?? '').endsWith('.csv')
  );
  assert.equal(csvCalls.length, 2, 'a users CSV and a messages CSV were sent');

  const usersCall = csvCalls.find((c) =>
    c.params.document.filename.startsWith('users-')
  );
  const messagesCall = csvCalls.find((c) =>
    c.params.document.filename.startsWith('messages-')
  );
  assert.ok(usersCall, 'the users CSV exists');
  assert.ok(messagesCall, 'the messages CSV exists');

  const decode = (call) => new TextDecoder().decode(call.params.document.bytes);
  const usersCsv = decode(usersCall);
  const messagesCsv = decode(messagesCall);

  const usersHeader = usersCsv.split('\n')[0];
  const messagesHeader = messagesCsv.split('\n')[0];
  assert.match(usersHeader, /tg_id/, 'the users CSV header names the Telegram id');
  assert.match(messagesHeader, /content/, 'the messages CSV header names the content');
  assert.match(usersHeader, /username/);

  assert.ok(usersCsv.includes('8401'), 'the users CSV lists the seeded users');
  assert.ok(usersCsv.includes('8402'));
  assert.ok(messagesCsv.includes('csv marker text'), 'the messages CSV holds the text');
  assert.match(messagesCsv, /message_type/);

  const storedMessages = row('SELECT count(*) AS n FROM messages').n;
  const csvDataRows = messagesCsv.trim().split('\n').length - 1;
  assert.equal(csvDataRows, storedMessages, 'every stored message is exported');
});

// ---------------------------------------------------------------------------
// 5. Rate limit helper
// ---------------------------------------------------------------------------

test('the rate limiter allows exactly the configured number of calls', async () => {
  await setupTest();
  const { consumeRateLimit } = await import('../tgcloud/lib/services/rateLimit.js');

  const results = [];
  for (let i = 0; i < 4; i++) {
    results.push(await consumeRateLimit(123, 'test', 3, 60));
  }
  assert.deepEqual(
    results.map((r) => r.allowed),
    [true, true, true, false],
    'the fourth call inside the window is refused'
  );
  assert.deepEqual(
    results.map((r) => r.count),
    [1, 2, 3, 4]
  );

  const counter = row('SELECT * FROM rate_limits WHERE key = ?', '123:test');
  assert.ok(counter, 'the limiter keeps one counter per key');
  assert.equal(counter.count, 4);

  // A different action has its own budget.
  const other = await consumeRateLimit(123, 'other', 3, 60);
  assert.equal(other.allowed, true);
  assert.equal(other.count, 1);
});

// ---------------------------------------------------------------------------
// 6. Banned recipients
// ---------------------------------------------------------------------------

test('a banned recipient is unreachable and receives nothing', async () => {
  await setupTest();
  await sendStart(8501);
  const token = await getToken(8501);
  await sendStart(8502);
  await sendStart(ADMIN);

  await sendFrom(ADMIN, '/ban 8501');
  assert.match(lastBotMessage(ADMIN).text, /مسدود شد/);

  const banned = await getUser(8501);
  assert.ok(banned, 'the recipient is still a registered user');
  const banRow = row(
    'SELECT * FROM banned_users WHERE user_id = ? AND active = 1',
    banned.id
  );
  assert.ok(banRow, 'the ban is active');
  assert.ok(await getActiveLink(8501), 'the banned owner keeps their link');

  await openLink(8502, token);
  const unavailable = lastTextContaining(8502, 'در دسترس نیست');
  assert.ok(unavailable, 'the sender is told the link is unavailable');

  await sendFrom(8502, 'can you hear me');

  const delivered = rows(
    'SELECT * FROM messages WHERE recipient_id = ?',
    banned.id
  );
  assert.equal(delivered.length, 0, 'no message row was created for the banned user');

  assert.ok(
    !lastTextContaining(8502, 'ناشناس تحویل شد'),
    'the sender was not told the message was delivered'
  );
  assert.ok(
    !botMessages(8501).some((m) => (m.text ?? m.caption) === 'can you hear me'),
    'the banned recipient received nothing'
  );
  assert.equal(
    row('SELECT count(*) AS n FROM messages').n,
    0,
    'the message was never stored'
  );
});

test('a recipient banned after the link was opened still cannot receive', async () => {
  await setupTest();
  await sendStart(8511);
  const token = await getToken(8511);
  await sendStart(8512);
  await openLink(8512, token);
  await sendStart(ADMIN);

  await sendFrom(ADMIN, '/ban 8511');
  const banned = await getUser(8511);

  await sendFrom(8512, 'hello after the ban');
  const delivered = rows('SELECT * FROM messages WHERE recipient_id = ?', banned.id);
  assert.equal(delivered.length, 0, 'the banned recipient got no message row');
  assert.ok(
    !lastTextContaining(8512, 'ناشناس تحویل شد'),
    'the sender got no success notice'
  );
  assert.ok(
    lastTextContaining(8512, 'در دسترس نیست') ||
      lastTextContaining(8512, 'گفتگوی ناشناسی انتخاب نشده'),
    'the sender got an unavailable/paused notice'
  );
  assert.equal(
    botMessages(8511).filter((m) => (m.text ?? m.caption) === 'hello after the ban').length,
    0
  );
});
