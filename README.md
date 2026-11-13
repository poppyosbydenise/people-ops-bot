# People Ops Bot

Slack bot for the people ops team. Posts morning briefings, EOD wrap-ups, and a weekly leadership board to `#people-ops-tasks`. Backed by Google Sheets.

---

## Google Sheet Setup

Create a new Google Sheet with these columns in row 1:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| **Task** | **Priority** | **Due Date** | **Status** | **Assigned To** | **Notes** |
| Review comp adjustments | p0 | | Pending | Alex | |
| Schedule DevOps interviews | p1 | | Pending | Sam | |

**Priority values:** `p0` (high) · `p1` (medium) · `p2` (low)  
**Status values:** `Pending` · `Done`  
**Assigned To:** `Alex` or `Sam`

Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/`**THIS_PART**`/edit`

---

## Google Sheets API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → enable the **Google Sheets API**
3. **IAM & Admin → Service Accounts** → Create service account → Keys tab → Add Key → JSON
4. Save the downloaded file as `credentials.json` in this folder
5. Share your Google Sheet with the service account email (Editor access)

---

## Slack App Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. **Create New App → From a manifest** → paste `manifest.json` → Create
3. **Install App** → Install to Workspace → Authorize
4. Invite the bot to `#people-ops-tasks`: type `/invite @People Ops Bot` in that channel

**Tokens to copy into `.env`:**
- **Bot Token**: Settings → Install App → `xoxb-...`
- **App Token**: Basic Information → App-Level Tokens → Generate Token (scope: `connections:write`) → `xapp-...`

**Get user IDs:**  
Slack → click profile picture → Profile → ⋮ → Copy member ID

**Get channel ID:**  
Right-click `#people-ops-tasks` → View channel details → ID at the bottom (starts with `C`)

---

## Configure & Run

```bash
cd people-ops-bot
npm install
cp .env.example .env
# Fill in all values in .env
npm start
```

---

## Slash Commands

| Command | What it does |
|---|---|
| `/tasks` | All open tasks, grouped by person (ephemeral) |
| `/mytasks` | Your tasks only (ephemeral) |
| `/add Review comp adjustments` | Adds a task assigned to you |
| `/add sam: Schedule interviews` | Adds a task assigned to Sam |
| `/done 3` | Marks task #3 as complete |
| `/board` | Posts the leadership board to the channel now |

---

## Scheduled Notifications

Set up these HTTP triggers on [cron-job.org](https://cron-job.org) (free):

| Schedule | URL | What it does |
|---|---|---|
| Mon–Fri 8:00 AM | `https://your-app.railway.app/notify/morning?secret=XXX` | Morning task board |
| Mon–Fri 5:00 PM | `https://your-app.railway.app/notify/eod?secret=XXX` | EOD wrap-up |
| Every Monday 8:00 AM | `https://your-app.railway.app/notify/board?secret=XXX` | Weekly leadership board |

Replace `your-app.railway.app` with your Railway URL and `XXX` with your `NOTIFY_SECRET`.

---

## Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add all `.env` values as environment variables in Railway's dashboard
4. Paste your `credentials.json` contents as `GOOGLE_CREDENTIALS_JSON` (instead of uploading the file)
5. Railway auto-detects `npm start` — deploy

---

## Keep It Running Locally

```bash
npm install -g pm2
pm2 start index.js --name people-ops-bot
pm2 save
pm2 startup
```
