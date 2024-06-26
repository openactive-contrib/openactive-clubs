# OpenActive Clubs

Note: Work in progress!

This tool reads a number of Google Sheets and converts them into a single OpenActive JSON feed. Organizer and location info only.

## Usage

### Club owners
- Download the [OpenActive-Clubs-Template.xlsx](./OpenActive-Clubs-Template.xlsx) Excel file to your local machine, then upload it to your Google account
- Open the Excel file in the browser via G-Suite, then go to "File > Save as Google Sheets"
- Delete the Excel file
- Open the Google Sheets file, then in the top right click "Share"
  - Enter "services@openactive-clubs.iam.gserviceaccount.com" in the text box
  - Select "Viewer" from the dropdown menu
  - Uncheck "Notify people"
  - Click "Share"
- For a file called "https://docs.google.com/spreadsheets/d/1iK96_tAem8H8LjPMYHdBDWcUpyKtCYOgVVXaQanDY1o/", the file ID is "1iK96_tAem8H8LjPMYHdBDWcUpyKtCYOgVVXaQanDY1o". Determine your file ID and send it to hello@openactive.io.
- Fill in the file with your club information. See [OpenActive-Clubs-Example.xlsx](./OpenActive-Clubs-Example.xlsx) for help.

### Service owner
- Copy all except the Excel files from this repo to your server
- Make a file called "spreadsheet-ids.txt". Put the spreadsheet IDs sent from club owners into this file, one per line, no commas or other furniture.
- Contact the owner of the "services@openactive-clubs.iam.gserviceaccount.com" account to obtain the associated "key.json" file, which is used to authenticate the service with the club owners' files. This email address is owned by the ODI Google account "OpenActive Clubs" project, which is the root of the Google Sheets API functionality used herein. Don't attempt to contact this email address directly, it's only for automation.
- Put the "spreadsheet-ids.txt" file and the "key.json" file in a non-public folder on your server. In the location where the code runs, make environment variables called `RELATIVE_FILEPATH_SPREADSHEET_IDS` and `RELATIVE_FILEPATH_KEY`, and set them to the relative filepaths of their respective files, including the file names. You may need to mount the storage location to the service in order to access the files within it.
- Start the service via `node index.js`
- See the collated spreadsheet info as a single JSON feed at `https://<ADDRESS>/`
- If the contents of "spreadsheet-ids.txt" is updated, then the service will need to be restarted to produce the updated feed
