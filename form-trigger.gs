// Latin District LA - Google Form submission trigger
//
// HOW THIS WORKS:
//   When a promoter submits the Google Form, this script fires automatically.
//   It reads the form response, sets the uploaded flyer to public in Drive,
//   converts the Drive URL to a renderable format, and writes a new row
//   into the Events tab with active=FALSE and status=submitted.
//   An email notification is sent to the admin.
//
// SETUP (do once after pasting this file):
//   1. In Apps Script editor, select installTrigger from the function dropdown
//   2. Click Run
//   3. Approve Gmail and Drive permissions when Google prompts you
//   4. The trigger is now active - no web app deployment needed
//
// FIELD TITLES:
//   The constants below must match your Google Form question titles exactly.
//   If a field title in the form changes, update the constant here to match.

// Config
var EVENTS_TAB   = 'Events';
var NOTIFY_EMAIL = 'latindistrictla@gmail.com';

// Google Form question titles - must match the form exactly (case-sensitive)
var FIELD_EVENT_NAME  = 'Event Name';
var FIELD_VENUE       = 'Venue Name';
var FIELD_DATE        = 'Event Date';
var FIELD_TIME        = 'Start Time';
var FIELD_GENRE       = 'Genre';
var FIELD_EVENT_TYPE  = 'Event Type';
var FIELD_TICKET      = 'Ticket Link';
var FIELD_DESCRIPTION = 'Event Description';
var FIELD_FLYER       = 'Event Flyer';


// onFormSubmit
// Registered as a trigger. Fires automatically on every Google Form submission.
// Do not rename this function - the trigger references it by name.

function onFormSubmit(e) {
  try {
    var vals = e.namedValues;

    // Helper: get first value for a named field, trimmed
    function get(key) {
      var arr = vals[key];
      if (!arr || !arr[0]) return '';
      return String(arr[0]).trim();
    }

    // Extract flyer file ID from the Drive URL Google Forms writes
    // Google Forms stores file uploads as: https://drive.google.com/open?id=FILE_ID
    var rawFlyerUrl = get(FIELD_FLYER);
    var flyerFileId = '';
    var flyerImageUrl = '';

    var idMatch = rawFlyerUrl.match(/[?&]id=([^&\s]+)/);
    if (idMatch) {
      flyerFileId = idMatch[1];
    }

    // Set the Drive file to public so it renders on the website
    if (flyerFileId) {
      try {
        DriveApp.getFileById(flyerFileId).setSharing(
          DriveApp.Access.ANYONE_WITH_LINK,
          DriveApp.Permission.VIEW
        );
        flyerImageUrl = 'https://drive.google.com/uc?export=view&id=' + flyerFileId;
        Logger.log('Flyer set public: ' + flyerFileId);
      } catch (driveErr) {
        Logger.log('Drive permission error (non-fatal): ' + driveErr.toString());
        // Still write the row - admin can fix the flyer URL manually if needed
      }
    } else {
      Logger.log('No flyer file ID found in response: ' + rawFlyerUrl);
    }

    // Convert date from Google Forms format to YYYY-MM-DD
    // Google Forms returns dates as "04/01/2026" in US locale
    var rawDate = get(FIELD_DATE);
    var dateStr = rawDate;
    if (rawDate) {
      try {
        var parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) {
          dateStr = Utilities.formatDate(parsed, 'America/Los_Angeles', 'yyyy-MM-dd');
        }
      } catch (dateErr) {
        Logger.log('Date parse error (using raw value): ' + dateErr.toString());
      }
    }

    // Write row to Events tab
    // Column order must match Events tab schema exactly: A through R
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(EVENTS_TAB);
    if (!sheet) {
      throw new Error('Events tab not found. Check EVENTS_TAB config.');
    }

    sheet.appendRow([
      get(FIELD_EVENT_NAME),   // A  event_name
      get(FIELD_VENUE),        // B  venue
      dateStr,                 // C  date        YYYY-MM-DD
      get(FIELD_TIME),         // D  time
      get(FIELD_GENRE),        // E  genre        may be blank
      get(FIELD_EVENT_TYPE),   // F  event_type
      get(FIELD_TICKET),       // G  ticket_link  may be blank
      flyerImageUrl,           // H  flyer_image_url
      'FALSE',                 // I  featured     admin sets TRUE if needed
      'FALSE',                 // J  active       admin sets TRUE to publish
      '',                      // K  tailgate_time
      'submitted',             // L  status       admin sets approved to publish
      '',                      // M  venue_image_url
      '',                      // N  video_url
      '',                      // O  crowd_level
      get(FIELD_DESCRIPTION),  // P  description
      flyerFileId,             // Q  flyer_file_id
      'upload',                // R  flyer_source
    ]);

    Logger.log('Row written: ' + get(FIELD_EVENT_NAME) + ' at ' + get(FIELD_VENUE));

    // Send notification email - non-fatal: failure does not undo the row write
    try {
      var sheetUrl = 'https://docs.google.com/spreadsheets/d/' + ss.getId();
      var subject = '[Latin District LA] New submission: ' + get(FIELD_EVENT_NAME) + ' at ' + get(FIELD_VENUE);
      var body = [
        'New event submission received via Google Form.',
        'Row written to Events tab with active=FALSE and status=submitted.',
        '',
        'To publish: open the sheet, find the row, set active=TRUE and status=approved.',
        '',
        'Event:        ' + get(FIELD_EVENT_NAME),
        'Venue:        ' + get(FIELD_VENUE),
        'Date:         ' + dateStr,
        'Time:         ' + get(FIELD_TIME),
        'Type:         ' + get(FIELD_EVENT_TYPE),
        'Genre:        ' + get(FIELD_GENRE),
        'Ticket Link:  ' + (get(FIELD_TICKET) || 'none'),
        'Flyer URL:    ' + (flyerImageUrl || 'none - check Drive permissions'),
        'Flyer ID:     ' + (flyerFileId || 'none'),
        '',
        'Description:',
        get(FIELD_DESCRIPTION),
        '',
        'Open sheet: ' + sheetUrl,
      ].join('\n');

      GmailApp.sendEmail(NOTIFY_EMAIL, subject, body);
      Logger.log('Notification email sent to ' + NOTIFY_EMAIL);
    } catch (emailErr) {
      Logger.log('Email failed (non-fatal): ' + emailErr.toString());
    }

  } catch (err) {
    Logger.log('onFormSubmit error: ' + err.toString());
  }
}


// installTrigger
// Run this once from the Apps Script editor after pasting this file.
// It removes any existing onFormSubmit triggers and installs a fresh one.
// You only need to run this once. The trigger persists until you delete it.

function installTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('Removed existing onFormSubmit trigger');
    }
  }

  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onFormSubmit()
    .create();

  Logger.log('onFormSubmit trigger installed successfully');

  SpreadsheetApp.getUi().alert(
    'Trigger installed',
    'onFormSubmit is now registered on this spreadsheet.\n\n' +
    'Submit a test Google Form response to verify the full flow.\n' +
    'Check the Events tab for the new row and your inbox for the notification email.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
