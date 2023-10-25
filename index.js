const express = require('express');
const fs = require('fs');
const { google } = require('googleapis');
const readline = require('readline');

// -------------------------------------------------------------------------------------------------

const app = express();
const port = 8080;

// -------------------------------------------------------------------------------------------------

app.use(express.json());
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  getSpreadsheetIds();
});

// -------------------------------------------------------------------------------------------------

let spreadsheetIds = [];
async function getSpreadsheetIds() {
  const rl = await readline.createInterface({
    input: fs.createReadStream('spreadsheetIds.txt'),
  });

  rl.on('line', (line) => {
    spreadsheetIds.push(line);
  });
}

// -------------------------------------------------------------------------------------------------

async function authSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'key.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({
    version: "v4",
    auth: authClient
  });
  return {
    auth,
    authClient,
    sheets,
  };
}

// -------------------------------------------------------------------------------------------------

app.get('/clubs', async (req, res) => {
  const { sheets } = await authSheets();

  let clubs = [];
  for (spreadsheetId of spreadsheetIds) {
    const clubsCurrent = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Clubs',
    });
    clubs.push(...clubsCurrent.data.values.slice(1));
  }

  res.send(clubs);
});
