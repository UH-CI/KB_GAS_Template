/*
* Please make sure to read the following, it contains some hard-earned knowledge 
* that will likely shorten your KB/GAS learning curve.
*
* Below is my template Google Apps Script (GAS) code that gets called by a Kuali Build API
* form integration and writes the data out to a spreadsheet.  There's some other stuff in 
* here, like code to programmatically get the status of workflow approval steps, so 
* delete what you don't need.  If you don't plan on needing the workflow approval info, 
* delete "AUTH_TOKEN" and any code that uses it (getDocumentInfoForTesting and 
* getApprovalsForDocumentId).
*
* To get started, search for anywhere it says "<FILL THIS IN>" and edit those values for
* your situation or delete it as necessary (likely, in the case of the CI_ADMIN and 
* HPC_ADMIN email address declarations).  When the Kuali Build form integration gets 
* here, it invokes the doPost method which then formats the input and then parses 
* it in the parseHPCSubmission method.
*
* You'll need to make a dev version of your KB API integration over on 
* <https://hawaii-sbx.kualibuild.com/> (Click the three vertical dots next to the KB 
* logo in the header, then "Spaces and Settings," then click on the "Integrations" tab.  
* Make sure you are on the UH network or VPN, it's not needed for KB prod, but it is for 
* dev.  If you've changed your UH password in the last year or so, you'll likely need 
* your old UH password to get in.  You'll be able to see other examples there, feel 
* free to look at the "HPC Order Form Submission Test," your API should look very similar.  
* Once your dev integration seems to be working with GAS, ask Cameron to copy it over to production.
* You'll need to first deploy your GAS in order to get the url needed for your KB API integration.
*
* Once the first call from Kuali Build goes through this code, go to the log (instructions 
* are below), copy what you received from KB, and make a "testString" variable with that 
* content (there's an example declaration at the very end of the code).  Also, take a look 
* at the JSON and find the "APP_ID" and put it as the value of the constant with the same name.  
* Then you can call the "doTest" method directly in GAS so you can test the code locally without going 
* through a ton of KB submission.  I'd recommend working on getting the connection from 
* KB to GAS going first, that way you can get the expected input to the 
* doPost method and know the structure of everything so you can code it out from there.
*
* General/TLDR:
* 1.) Someone submits an order form via Kuali Build.
* 2.) Kuali Build sends all the information in JSON format to this script, calling the doPost method.
* 3.) The doPost method parses out all the information and puts it in sheets in the 
*     spreadsheet listed in "SPREADSHEET_URL" below.
*
* To redeploy your GAS w/o the url changing:
* - Click "Deploy" button
* - Click "Manage deployments" from the resulting drop down menu
* - Click the pencil icon for editing the deployment.
* - Set "version" as "New version".
* - Change the description if desired.
* - Click "Deploy" button.
*
* To see the logs of Kuali Build submissions, go to: https://console.cloud.google.com/logs/query
* You will need to make a Google Cloud project and then enter that project's ID in the 
* Google Cloud Platform (GCP) Project section of Project Settings for your app.
*
*/

const CI_ADMIN = "<FILL THIS IN>";
const HPC_ADMIN = "<FILL THIS IN>";
const COL_SENDER_EMAIL = "<FILL THIS IN>";

// the location of the spreadsheet will will write to and read from
const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/<FILL THIS IN>";
const SPREADSHEET_EDIT_URL = SPREADSHEET_URL + "/edit";
const SPREADSHEET_EXPORT_URL = SPREADSHEET_URL + "/export";
const ORDERS_SHEET_NAME = "Orders";
const ORDERS_SHEET = SpreadsheetApp
    .openByUrl((SPREADSHEET_EDIT_URL))
    .getSheetByName(ORDERS_SHEET_NAME);

// this is the id of the kuali build app (HPC Ordering System V2)that calls this program.  
// If you ever change the app, you need to look at the logs from the first call to get the applicationId and paste it here.
const APP_ID = "<FILL THIS IN>";  

// if you ever start getting {"message":"Unauthorized"} errors, go check your API keys
// https://hawaii.kualibuild.com/cor/main/#/users/<FILL THIS IN>/api-keys
// to make sure it hasn't expired.  If it is expired, create a new one, delete the old, 
// and copy the key into this AUTH_TOKEN variable below.
const AUTH_TOKEN="<FILL THIS IN>" 

const SPACER = "    ";
const COL_CI_APPROVAL_STATUS = "CI Approval Status";
const COL_SUBMISSION_DATE = "Submission Date";
const COL_DOCUMENT_ID = "Document ID";
const COL_INVOICE_NUM = "Invoice #";
const COL_INVOICE_ID = "Invoice ID";
const COL_CI_APPROVAL_STATUS_DATE = "CI Approved/Denied Date";

// from the orders sheet
const COL_INDEX_DOCUMENT_ID = getOrdersColIndex(COL_DOCUMENT_ID);
const COL_INDEX_ORDERS_INVOICE_NUM = getOrdersColIndex(COL_INVOICE_NUM);
const COL_INDEX_CI_APPROVAL_STATUS = getOrdersColIndex(COL_CI_APPROVAL_STATUS);
const COL_INDEX_CI_APPROVAL_STATUS_DATE = getOrdersColIndex(COL_CI_APPROVAL_STATUS_DATE);
const COL_INDEX_SUBMISSION_DATE = getOrdersColIndex(COL_SUBMISSION_DATE);

function doStringReplacements(stringIn) {
  var stringOut = stringIn
  .replace(/\\\"/g, '"')       //   '\"' with '"'
  .replace(/\"\{/g, '\{')      //   '"{' with '{'
  .replace(/\"\}\"/g, '\"\}')  //   '"}' with '}'
  .replace(/\}\"/g, '\}');     //   '}"' with '}'
  return stringOut;
}

// called whenever someone submits the associated Kuali Build form
function doPost(request) {
  Logger.log("doPost: ");
  try {
    Logger.log(request);
    var testString = JSON.stringify(request);
    Logger.log("doPost: " + testString);
    var json = doStringReplacements(testString);
    Logger.log("json: " + json);
    parseHPCSubmission(json);
  } 
  catch (err) {
    Logger.log("doPost err: " + err);
    return err;
  }
}

function doGet() {
  Logger.log("doGet, does nothing");
}

// to test locally using the testString below
function doTest() {
  try {
    //Logger.log("doTest: " + testString);
    var json = doStringReplacements(testString);
    //Logger.log("json: " + json);
    parseHPCSubmission(json);
  } 
  catch (err) {
    Logger.log("doTest err: " + err);
    return err;
  }
}

var ordersHeaderRow = undefined;
function setOrdersHeaderRow() {
    var range = ORDERS_SHEET.getDataRange();
    var data = range.getValues(); //returns a 2D array
    ordersHeaderRow = data[0]; // get all the entries in the first row
    return ordersHeaderRow.length;
}

function getOrdersColIndex(key) {
  if (!ordersHeaderRow) { setOrdersHeaderRow();}
  return ordersHeaderRow.indexOf(key);
}

function getNewOrderInvoiceNumber() {
    var lastRow = ORDERS_SHEET.getLastRow();  // returns the _location_ of the last row
    var lastCell = ORDERS_SHEET.getRange(lastRow, 1);
    var newInvoiceNumber = lastCell.getValue() + 1;

    Logger.log("getNewOrderInvoiceNumber:" + newInvoiceNumber);
    return newInvoiceNumber;
}

function printArrayContents(row, spacer) {
  Logger.log("printArrayContents");
  for (var v in row) {
    Logger.log(spacer + "index: " + v + ", " + row[v]);
  }
}

/*
* Converts a string in epoch date format to a human readable date string and returns that
*/ 
function epochDateConverter(utcSeconds, spacer = "") {
  //Logger.log(spacer + "epochDateConverter: " + utcSeconds);
  var d = new Date(0); // The 0 there is the key, which sets the date to the epoch
  d.setUTCSeconds(utcSeconds / 1000);
  //Utilities.formatDate(date, 'America/New_York', 'MMMM dd, yyyy HH:mm:ss Z')
  var formattedDate = Utilities.formatDate(d, "HST", "MM-dd-yyyy HH:mm:ss");
  //Logger.log(spacer + "epochDateConverter: " + formattedDate);
  return formattedDate;
}

function convertNumberToCurrency(number) {
  number = number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  var result = "$" + number;
  return result;
}

/*
* Does the following:
* - Gets the index of spreadsheetColName in the Orders sheet.
* - Calls getValue to parse the value of jsonKey from the jsonObj and do the appropriate conversions on it
* - Stores the result of the getValue call in the givenarray at the previously retrieved index
* - Returns the value of index
*/
function setOrdersValue(arr, spreadsheetColName, jsonObj, jsonKey, convertToCurrency, convertToDate, spacer = "") {
  try {
    Logger.log("setOrdersValue");
    index = getOrdersColIndex(spreadsheetColName);
    value = getValue(jsonObj, jsonKey, convertToCurrency, convertToDate, spacer);
    arr[index] = value;
    Logger.log("setOrdersValue " + jsonKey + ", " + value);
    return index;
  } catch (err) {
    Logger.log("setOrdersValue Error: " + err);
    Logger.log(spacer + "spreadsheetColName: " + spreadsheetColName);
    Logger.log(spacer + "jsonObj: " + jsonObj);
    Logger.log(spacer + "jsonKey: " + jsonKey);
  }
}

/*
* Gets the index of spreadsheetColName in the Orders sheet and assign the 
* given value to that index in the given array.  No processing is done on the
* value, it's just assigned as-is.
*/
function setOrdersValueWithValue(arr, spreadsheetColName, value, spacer = "") {
  Logger.log("setOrdersValueWithValue");
  var index = getOrdersColIndex(spreadsheetColName);
  arr[index] = value;
  Logger.log(spacer + spreadsheetColName + ": " + value);
  return index;
}

/*
* Does the following:
* - Gets the value at jsonKey from jsonObj.  
* - If there is no value, returns an empty string
* - If there is a value:
*    - if convertToCurrency is true, it calls a method to turn the string into a currency string
*    - if convertToDate is true, calls a method to turn the epoch date into a human readable string
* - Returns the result.
*/
function getValue(jsonObj, jsonKey, convertToCurrency, convertToDate, spacer = "") {
  value = "";
  if (jsonObj[jsonKey]) {
    value = jsonObj[jsonKey];
    if (convertToCurrency) {
      value = convertNumberToCurrency(value);
    }
    else if (convertToDate) {
      value = epochDateConverter(value);
    }
  }
  Logger.log(spacer + jsonKey + ": " + value);
  return value;
}

/* 
* When a document gets sent back, it starts all over from scratch in Kuali Build, 
* approvals and all, so if a document gets resubmitted, delete the existing 
* spreadsheet records so the new one can take its place
*/
function handleDocAlreadySubmitted(docIdIn) {
  Logger.log("handleDocAlreadySubmitted");
  var lastCol = ORDERS_SHEET.getLastColumn();
  var rowRange = ORDERS_SHEET.getRange(2, 1, ORDERS_SHEET.getLastRow() - 1, lastCol);
  var rows = rowRange.getValues();
  for (var i = 0; i < rows.length; i++) {
    var docId = rows[i][COL_INDEX_DOCUMENT_ID];
    if (docId === docIdIn) {
      Logger.log("Document has been previously submitted, deleting existing rows");
      var invoiceNum = rows[i][COL_INDEX_ORDERS_INVOICE_NUM];
      ORDERS_SHEET.deleteRow(i + 2);
      return;
    }
  }
}

/* Handles parsing the Kuali Build form submission:
 *   writes it all out to the spreadsheet as needed,
 *   sends the initial registration confirmation emails,
 *   sends the mailing list add emails.
 */
function parseHPCSubmission(request) {
  try {
    //Logger.log("parseHPCSubmission: " + request);
    Logger.log("parseHPCSubmission: ");

    var params = JSON.parse(request);
    //Logger.log("params: " + JSON.stringify(params));
    var contents = params.postData.contents;
    Logger.log("contents: " + JSON.stringify(contents));
    var appId = contents.applicationId;
    var docId = contents.documentId;
    Logger.log("AppId: " + appId);
    handleDocAlreadySubmitted(docId);

    // submission must come from the correct KualiBuild app
    if (contents.applicationId == APP_ID) {
      rowLength = setOrdersHeaderRow();
      var orderInfo = [rowLength];

      // submission/submitter info
      Logger.log("Submission Info:");
      var submittedBy = contents.meta.submittedBy;
      
      var invoiceNumber = getNewOrderInvoiceNumber();
      setOrdersValueWithValue(orderInfo, COL_INVOICE_NUM, invoiceNumber, SPACER);

      // name of person who submitted this request
      setOrdersValue(orderInfo, "Submittor Name", submittedBy, "displayName", false, false, SPACER);
      
      // email of person who submitted this request
      setOrdersValue(orderInfo, "Submittor Email", submittedBy, "email", false, false, SPACER);

      // date/time PO was submitted
      setOrdersValue(orderInfo, "Submission Date", contents.meta, "submittedAt", false, true, SPACER);

      // uniquely identify this submission, record the document ID so it's easy to find in Kuali
      setOrdersValue(orderInfo, "Document ID", contents, "documentId", false, false, SPACER);

      // uniquely identify this submission, record the serial number so it's easy to find in Kuali
      setOrdersValue(orderInfo, "Serial_Number", contents.meta, "serialNumber", false, false, SPACER);

      // Comments
      setOrdersValue(orderInfo, "Submittor Comments", contents, "Comments", false, false, SPACER);

      addToSpreadsheet(orderInfo, ORDERS_SHEET);
    } // if (contents.applicationId == "<expected appId>") {
    return ContentService.createTextOutput('200 OK');
  }
  catch (err) {
    Logger.log("Err: " + err);
    return err;
  }
}

function addToSpreadsheet(row, sheet) {
  Logger.log("AddToSpreadsheet (" + sheet + "): " + row);
  try {
    rowIndex = sheet.appendRow(row);
  }
  catch (err) {
    Logger.log("HPCInvoicing.addToSpreadsheet error: " + err);
    if (err == 'Exception: Invalid argument: url') {
      err = 'Invalid URL';
      res['Spreadsheet URL'] = null;
    }
    return err;
  }
}

// Wasn't sure if it was worth separating this out to be effectively a 
// one line function, but wanted the error handling around it in case
// this fails, I didn't want other things to fail
function sendEmail(toEmail, subject, body, optionsIn) {
  try {
    //GmailApp.sendEmail(toEmail, subject, body, optionsIn);
    return true;
  }
  catch (err) {
    Logger.log("err: " + err);
    return false;
  }
}

/*
* Gets all orders which are missing a CI approval and nag as appropriate.
* This is run via a nightly cron job.  
* What it does:
* 1.) Get all rows from the "Orders" sheet where "CI Approval Date" is empty.  
* 2.) For each matching record, get the associated "Invoice #"
* 3.) Get the "Document ID" from the "Orders" sheet where the "Invoice #" matches.
* 4.) Hit the qraphQL API and see if any of those missing approvals came in.
*     - If yes: update the spreadsheet and bail on the current record.
*     - If not: move on to step 5
* 5.) Get the "Submission Date" from the "Orders" sheet with the matching "Invoice #"
* 6.) Compare today's date and the submission date and if the time frame between them
*     is correct, send either the missing person and/or Michelle a nag/reminder notice.
*/
function handleMissingApprovalDenialInvoices() {
  Logger.log("handleMissingApprovalDenialInvoices");

  // get the entire orders sheet
  var lastCol = ORDERS_SHEET.getLastColumn();
  var data = ORDERS_SHEET.getDataRange().getValues();
  // start at 1 to skip the header row
  // loop through all the rows in the orders sheet
  for (var n = 1; n < data.length ;  n++){
    var row = data[n];
    var orderRowRange = ORDERS_SHEET.getRange(n + 1, 1, 1, lastCol);
    var ciApprovalStatusCell = orderRowRange.getCell(1, COL_INDEX_CI_APPROVAL_STATUS + 1);
    var ciApprovalStatusDateCell = orderRowRange.getCell(1, COL_INDEX_CI_APPROVAL_STATUS_DATE + 1);

    // for the given row, check if it already has an approval status, if not, continue
    var ciApprovalStatus = ciApprovalStatusCell.getValue();
    Logger.log("ciApprovalStatusCell: " + ciApprovalStatus + ", invoice#: " + n);

    // had to change this as they added in new statuses so had to go with the != instead of = 
    // to guarantee it would get processed when we encounter things we don't expect
    const finishedStatuses = ['Approved', 'Withdrawn', 'Denied', 'Skipped'];
    // only process if the current status for ci or hpc in the spreadsheet is not one of the "completed" statuses
    if (finishedStatuses.indexOf(ciApprovalStatus) === -1 || finishedStatuses.indexOf(hpcApprovalStatus) === -1) {
      var invoiceId = row[COL_INDEX_ORDERS_INVOICE_NUM];
      var docId = row[COL_INDEX_DOCUMENT_ID];
      //Logger.log("No approval status found for order number: " + invoiceId + ", docID: " + docId);

      // Go check for CI approval/denial on the document
      var docIdApprovals = getApprovalsForDocumentId(docId);
      //Logger.log("docIDApprovals: " + JSON.stringify(docIdApprovals));

      // loop through all approval statuses and save any CI actions to the orders spreadsheet
      for (var i = 0; i < docIdApprovals.length; i++) {
        var docIdApproval = docIdApprovals[i];
        //Logger.log("docId: " + docId + ",invoiceId: " + invoiceId + ", " + JSON.stringify(docIdApproval));

        if (docIdApproval.type == "CI") {
          if (ciApprovalStatusCell.getValue() != docIdApproval.status && docIdApproval.status != "In Progress") {
            Logger.log("Existing: " + ciApprovalStatusCell.getValue() + ", new: " + docIdApproval.status);
            ciApprovalStatusCell.setValue(docIdApproval.status);
            ciApprovalStatusDateCell.setValue(docIdApproval.date);
          }
        }
      } // end of looping of status steps for the current row

      // if ci approvals is missing, send nag notice if at a one week interval from submission
      if (ciApprovalStatusCell.getValue() === "") {
        var docSubmissionDate = orderRowRange.getCell(1, COL_INDEX_SUBMISSION_DATE + 1).getValue();
        //sendEmail(nagRecipient, subject, body);
      }
    }  // if (ciApprovalStatus == '' || ciApprovalStatus == "Sent Back") 
  }  // end of looping through all the rows in the orders sheet
}

// this is not used anywhere in production, it's called directly by a developer for testing purposes
// the developer needs to plus in the ID of the document they want to see either the data or metadata (approvals on)
// nothing gets processed, it just returns the info.
function getDocumentInfoForTesting() {
  var docId = "<FILL THIS IN>"; 
  var resultType = "data"; 
  //var resultType = "meta"; 

  approvalUrl = 'https://hawaii.kualibuild.com/app/api/v0/graphql?query=query{app(id:"'+ APP_ID + '"){document(id:"' + docId + '"){' + resultType+ '}}}'; 
  encodedUrl = encodeURI(approvalUrl); 

  const params = { 
    method : 'get', 
    headers: { 
      'Authorization': 'Bearer ' + AUTH_TOKEN 
    } 
  } 

  var response = UrlFetchApp.fetch(encodedUrl, params) 
  var respJson = JSON.parse(response.getContentText()); 
  Logger.log(respJson); 
}

// just a test method, not used anywhere in code, called directly by user for testing purposes
function getApprovalsForDocumentIdTester() {
  var docId = "<FILL THIS IN>";
  var results = getApprovalsForDocumentId(docId);
  // print out the results
  results.forEach((result) => {
    Logger.log("docId: " + docId + ", type: " + result.type + ", status: " + result.status + ", date: " + result.date);
    //Logger.log(JSON.stringify(result));
  });
}

function getApprovalsForDocumentId(docId) {
  Logger.log("getApprovalsForDocumentId: " + docId);
  approvalUrl = 'https://hawaii.kualibuild.com/app/api/v0/graphql?query=query{app(id:"'+ APP_ID + '"){document(id:"' + docId + '"){meta}}}';
  Logger.log("approvalUrl: " + approvalUrl);

  encodedUrl = encodeURI(approvalUrl);
  //Logger.log("encodedUrl: " + encodedUrl);
  //Logger.log("APP_ID: " + APP_ID);

  const params = { 
    method : 'get', 
    headers: { 
      'Authorization': 'Bearer ' + AUTH_TOKEN 
    } 
  } 
  var response = UrlFetchApp.fetch(encodedUrl, params) 
  var respJson = JSON.parse(response.getContentText()); 
  //Logger.log(respJson); 

  var results = [];
  var steps = respJson.data.app.document.meta.simulation.steps;
  for (var i in steps) {
    var step = steps[i];
    processFormApprovalStep(results, step);
    var subflows = step.subflows;
    if (subflows) {
      for (var k in subflows) {
        var substeps = subflows[k].steps;
        for (var j in substeps) {
          step = substeps[j];
          processFormApprovalStep(results, step);
        }
      }
    }
  }
  return results;
}

function processFormApprovalStep(results, step) {
  //Logger.log("processFormApprovalStep");
  var type = step.type;
  //Logger.log("stepType: " + type);
  if (type == "approval") {
    Logger.log("Step: " + JSON.stringify(step));
    var status = step.status;
    // if there's no status, don't do anything as no action has been taken on this step
    if (status) {
      //Logger.log("status: " + status);
      // rejected steps don't have an associated date, so make it today if there's none provided
      var date = new Date();
      if (step.completedAt) {
        date = step.completedAt;
      }
      // only care about steps that are CI related, ignore other ones
      if (step.stepName.startsWith("CI")) {
        var result = {"type":"CI", "status":status, "date":date}
        results.push(result);
        //Logger.log("returning: " + JSON.stringify(result));
      }
    }
  }
}




testString = '{"contentLength":,"postData":{"contents":{"applicationId":"","documentId":"","formId":"","meta":{"createdBy":{"id":"","label":"","displayName":"","username":"","email":"","schoolId":"","firstName":"","lastName":""},"submittedBy":{"id":"","label":"","displayName":"","username":"","email":"","schoolId":"","firstName":"","lastName":""},"createdAt":,"serialNumber":"","appPublishVersion":,"formContainer":{"id":"","label":""},"workflowTotalRuntime":null,"title":"","submittedAt":}},"length":,"name":"postData","type":"application/json"},"parameter":{},"queryString":"","contextPath":"","parameters":{}}';

