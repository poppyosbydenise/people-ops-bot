require('dotenv').config();
const { App } = require('@slack/bolt');
const http = require('http');
const { getTasks, appendTask, markDone } = require('./sheets');

const {
  SLACK_BOT_TOKEN,
  SLACK_APP_TOKEN,
  SLACK_USER_ALEX,
  SLACK_USER_SAM,
  SLACK_CHANNEL_ID,
  NOTIFY_SECRET,
} = process.env;

// Map Slack user IDs → display names
const USER_NAMES = {
  [SLACK_USER_ALEX]: 'Alex',
  [SLACK_USER_SAM]: 'Sam',
};

const PRIORITY_EMOJI = { p0: '🔴', p1: '🟡', p2: '🟢', High: '🔴', Medium: '🟡', Low: '🟢' };
const PRIORITY_ORDER = { p0: 0, p1: 1, p2: 2, High: 0, Medium: 1, Low: 2 };

const app = new App({
  token: SLACK_BOT_TOKEN,
  appToken: SLACK_APP_TOKEN,
  socketMode: true,
});

// ── Formatting helpers ───────────────────────────────────────

function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));
}

function formatPersonBlock(name, tasks) {
  if (tasks.length === 0) return `*${name}*\n_No open tasks_ ✅\n`;
  const lines = sortByPriority(tasks).map((t) => {
    const emoji = t.status === 'Done' ? '✅' : (PRIORITY_EMOJI[t.priority] || '⚪');
    const due = t.dueDate ? ` _(${t.dueDate})_` : '';
    const notes = t.notes ? ` — ${t.notes}` : '';
    return `${emoji}  *${t.num}.* ${t.task}${due}${notes}`;
  });
  return `*${name}*\n${lines.join('\n')}\n`;
}

// ── Channel post helper ──────────────────────────────────────

async function postToChannel(text) {
  await app.client.chat.postMessage({
    channel: SLACK_CHANNEL_ID,
    text,
    mrkdwn: true,
  });
}

// ── Notification functions ───────────────────────────────────

async function notifyMorning() {
  const tasks = await getTasks();
  const pending = tasks.filter((t) => t.status !== 'Done');

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  let msg = `☀️ *Good morning! Here's the People Ops board for ${today}*\n\n`;

  const alexTasks = pending.filter((t) => t.assignedTo === 'Alex');
  const samTasks = pending.filter((t) => t.assignedTo === 'Sam');

  msg += formatPersonBlock('Alex', alexTasks);
  msg += '\n';
  msg += formatPersonBlock('Sam', samTasks);

  if (pending.length === 0) {
    msg += '_All tasks complete — clean slate!_ 🎉';
  } else {
    msg += `\n_${pending.length} task${pending.length === 1 ? '' : 's'} open · use \`/done <num>\` to mark complete_`;
  }

  await postToChannel(msg);
  console.log('✅ Morning post sent');
}

async function notifyEod() {
  const tasks = await getTasks();
  const done = tasks.filter((t) => t.status === 'Done');
  const pending = tasks.filter((t) => t.status !== 'Done');

  const alexDone = done.filter((t) => t.assignedTo === 'Alex').length;
  const alexPending = pending.filter((t) => t.assignedTo === 'Alex').length;
  const samDone = done.filter((t) => t.assignedTo === 'Sam').length;
  const samPending = pending.filter((t) => t.assignedTo === 'Sam').length;

  let msg = `🌙 *End-of-Day Wrap-Up*\n\n`;
  msg += `👤 *Alex:* ✅ ${alexDone} done · ⏳ ${alexPending} remaining\n`;
  msg += `👤 *Sam:* ✅ ${samDone} done · ⏳ ${samPending} remaining\n\n`;

  if (pending.length > 0) {
    msg += `*Still open:*\n`;
    sortByPriority(pending).forEach((t) => {
      const emoji = PRIORITY_EMOJI[t.priority] || '⚪';
      msg += `${emoji}  *${t.num}.* ${t.task} _(${t.assignedTo})_\n`;
    });
  } else {
    msg += `🎉 *Everything's done — great work!*`;
  }

  await postToChannel(msg);
  console.log('✅ EOD wrap-up sent');
}

async function notifyBoard() {
  const tasks = await getTasks();
  const done = tasks.filter((t) => t.status === 'Done');
  const pending = tasks.filter((t) => t.status !== 'Done');

  const alexDone = done.filter((t) => t.assignedTo === 'Alex').length;
  const alexPending = pending.filter((t) => t.assignedTo === 'Alex').length;
  const samDone = done.filter((t) => t.assignedTo === 'Sam').length;
  const samPending = pending.filter((t) => t.assignedTo === 'Sam').length;

  const totalDone = done.length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
  const bar = '▓'.repeat(Math.floor(completionRate / 10)) + '░'.repeat(10 - Math.floor(completionRate / 10));

  let msg = `📊 *People Ops — Leadership Board*\n`;
  msg += `_${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}_\n\n`;
  msg += `${bar}  *${completionRate}% overall*\n\n`;
  msg += `👤 *Alex* — ✅ ${alexDone} done · ⏳ ${alexPending} open\n`;
  msg += `👤 *Sam* — ✅ ${samDone} done · ⏳ ${samPending} open\n\n`;
  msg += `_Total: ${totalDone} / ${totalTasks} tasks completed_`;

  await postToChannel(msg);
  console.log('✅ Leadership board posted');
}

// ── Slash commands ───────────────────────────────────────────

app.command('/tasks', async ({ ack, respond }) => {
  await ack();
  try {
    const tasks = await getTasks();
    const pending = tasks.filter((t) => t.status !== 'Done');

    if (pending.length === 0) {
      await respond({ text: '📋 *All Tasks*\n\n_Nothing open — all done!_ 🎉', response_type: 'ephemeral' });
      return;
    }

    let msg = `📋 *All Open Tasks*\n\n`;
    const alexTasks = pending.filter((t) => t.assignedTo === 'Alex');
    const samTasks = pending.filter((t) => t.assignedTo === 'Sam');
    msg += formatPersonBlock('Alex', alexTasks);
    msg += '\n';
    msg += formatPersonBlock('Sam', samTasks);

    await respond({ text: msg, response_type: 'ephemeral' });
  } catch (err) {
    await respond({ text: `❌ Error: ${err.message}`, response_type: 'ephemeral' });
  }
});

app.command('/mytasks', async ({ ack, respond, command }) => {
  await ack();
  try {
    const name = USER_NAMES[command.user_id];
    if (!name) {
      await respond({ text: '⚠️ Your Slack user ID isn\'t configured. Add it to `.env` as `SLACK_USER_ALEX` or `SLACK_USER_SAM`.', response_type: 'ephemeral' });
      return;
    }

    const tasks = await getTasks();
    const mine = tasks.filter((t) => t.assignedTo === name && t.status !== 'Done');

    if (mine.length === 0) {
      await respond({ text: `📋 *Your Tasks (${name})*\n\n_All clear!_ ✅`, response_type: 'ephemeral' });
      return;
    }

    let msg = `📋 *Your Tasks (${name})*\n\n`;
    sortByPriority(mine).forEach((t) => {
      const emoji = PRIORITY_EMOJI[t.priority] || '⚪';
      const due = t.dueDate ? ` _(${t.dueDate})_` : '';
      const notes = t.notes ? ` — ${t.notes}` : '';
      msg += `${emoji}  *${t.num}.* ${t.task}${due}${notes}\n`;
    });

    await respond({ text: msg, response_type: 'ephemeral' });
  } catch (err) {
    await respond({ text: `❌ Error: ${err.message}`, response_type: 'ephemeral' });
  }
});

app.command('/add', async ({ ack, respond, command }) => {
  await ack();
  const text = command.text.trim();
  if (!text) {
    await respond({ text: '⚠️ Usage:\n• `/add Review comp adjustments` — assigns to you\n• `/add sam: Schedule interviews` — assigns to Sam', response_type: 'ephemeral' });
    return;
  }

  try {
    let assignedTo = USER_NAMES[command.user_id] || 'Alex';
    let taskText = text;

    // Check for "sam:" or "alex:" prefix
    const prefixMatch = text.match(/^(alex|sam):\s*/i);
    if (prefixMatch) {
      assignedTo = prefixMatch[1].charAt(0).toUpperCase() + prefixMatch[1].slice(1).toLowerCase();
      taskText = text.slice(prefixMatch[0].length).trim();
    }

    if (!taskText) {
      await respond({ text: '⚠️ Please include a task description after the name prefix.', response_type: 'ephemeral' });
      return;
    }

    await appendTask(taskText, 'p1', assignedTo);
    const tasks = await getTasks();
    await respond({ text: `✅ Added *"${taskText}"* → assigned to *${assignedTo}* (task #${tasks.length})`, response_type: 'ephemeral' });
  } catch (err) {
    await respond({ text: `❌ Error: ${err.message}`, response_type: 'ephemeral' });
  }
});

app.command('/done', async ({ ack, respond, command }) => {
  await ack();
  const taskNum = parseInt(command.text.trim(), 10);
  if (!taskNum || taskNum < 1) {
    await respond({ text: '⚠️ Usage: `/done 3`', response_type: 'ephemeral' });
    return;
  }

  try {
    const tasks = await getTasks();
    if (taskNum > tasks.length) {
      await respond({ text: `⚠️ Task #${taskNum} doesn't exist. Use \`/tasks\` to see the list.`, response_type: 'ephemeral' });
      return;
    }
    const t = tasks[taskNum - 1];
    await markDone(taskNum);
    await respond({ text: `✅ Marked *"${t.task}"* as done! 🎉`, response_type: 'ephemeral' });
  } catch (err) {
    await respond({ text: `❌ Error: ${err.message}`, response_type: 'ephemeral' });
  }
});

app.command('/board', async ({ ack, respond }) => {
  await ack();
  try {
    await notifyBoard();
    await respond({ text: '📊 Leadership board posted to #people-ops-tasks', response_type: 'ephemeral' });
  } catch (err) {
    await respond({ text: `❌ Error: ${err.message}`, response_type: 'ephemeral' });
  }
});

// ── HTTP server for cron-job.org triggers ───────────────────

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (NOTIFY_SECRET && url.searchParams.get('secret') !== NOTIFY_SECRET) {
    res.writeHead(401); res.end('Unauthorized');
    return;
  }

  const handlers = {
    '/notify/morning': async () => { await notifyMorning(); res.end('OK - morning'); },
    '/notify/eod':     async () => { await notifyEod();     res.end('OK - eod');     },
    '/notify/board':   async () => { await notifyBoard();   res.end('OK - board');   },
    '/health':         async () => {                        res.end('OK');           },
  };

  const handler = handlers[url.pathname];
  if (!handler) { res.writeHead(404); res.end('Not found'); return; }

  try {
    res.writeHead(200);
    await handler();
  } catch (err) {
    console.error(`Error on ${url.pathname}:`, err.message);
    res.writeHead(500); res.end('Error: ' + err.message);
  }
});

// ── Start ────────────────────────────────────────────────────

(async () => {
  await app.start();
  server.listen(PORT, () => {
    console.log(`⚡ People Ops Bot running! HTTP on port ${PORT}`);
  });
})();
