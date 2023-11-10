# OpenActive Club Finder

Note: Work in progress!

This tool reads a number of Google Sheets and converts them into a single OpenActive JSON feed. Organizer and location info only.

## Usage

### Club owners
- Download the [OpenActive-Club-Finder-Template.xlsx](./OpenActive-Club-Finder-Template.xlsx) Excel file to your local machine, then upload it to your Google account
- Open the Excel file in the browser via G-Suite, then go to "File > Save as Google Sheets"
- Delete the Excel file
- Open the Google Sheets file, then in the top right click "Share"
  - Enter "openactive-club-finder@openactive.iam.gserviceaccount.com" in the text box
  - Select "Viewer" from the dropdown menu
  - Uncheck "Notify people"
  - Click "Share"
- For a file called "https://docs.google.com/spreadsheets/d/1iK96_tAem8H8LjPMYHdBDWcUpyKtCYOgVVXaQanDY1o/edit#gid=835570708", the file ID is "1iK96_tAem8H8LjPMYHdBDWcUpyKtCYOgVVXaQanDY1o". Determine your file ID and send it to hello@openactive.io.
- Fill in the file with your club information. See [OpenActive-Club-Finder-Example.xlsx](./OpenActive-Club-Finder-Example.xlsx) for help.

### Service owner
- Copy all except the Excel files from this repo to your server
- Make a file called "spreadsheetIds.txt" in the same directory as "index.js"
- Put the spreadsheet IDs sent from club owners in this file, one per line, no commas or other furniture
- Contact the code owner to obtain the "key.json" file
- Upload the "key.json" file to the same server directory as "index.js". This authenticates the service as the email address that club owners share their files with. This email address is owned by the ODI Google account, which is the root of the Google Sheets API functionality used herein.
- Start the service via `node index.js`
- See the collated spreadsheet info as a single JSON feed at `http://<ADDRESS>/clubs`
- If the contents of "spreadsheetIds.txt" is updated, then the service will need to be restarted to produce the updated feed
