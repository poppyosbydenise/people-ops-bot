const { google } = require('googleapis');
const fs = require('fs');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB = process.env.GOOGLE_SHEET_TAB || 'Tasks';

function getSheets() {
  const creds = process.env.GOOGLE_CREDENTIALS_JSON
    ? JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON)
    : JSON.parse(fs.readFileSync(process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json', 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// Columns: A=Task, B=Priority, C=Due Date, D=Status, E=Assigned To, F=Notes
async function getTasks() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A2:F`,
  });
  const rows = res.data.values || [];
  return rows.map((row, i) => ({
    num: i + 1,
    task: row[0] || '',
    priority: row[1] || 'p1',
    dueDate: row[2] || '',
    status: row[3] || 'Pending',
    assignedTo: row[4] || 'Alex',
    notes: row[5] || '',
  }));
}

async function appendTask(task, priority, assignedTo, notes = '') {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A:F`,
    valueInputOption: 'RAW',
    requestBody: { values: [[task, priority, '', 'Pending', assignedTo, notes]] },
  });
}

async function markDone(taskNum) {
  const sheets = getSheets();
  const rowIndex = taskNum + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!D${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Done']] },
  });
}

module.exports = { getTasks, appendTask, markDone };
