# KB_GAS_Template
Below is my template Google Apps Script (GAS) code that gets called by a Kuali Build API
form integration and writes the data out to a spreadsheet.  There's some other stuff in 
here, like code to programmatically get the status of workflow approval steps, so 
delete what you don't need.  If you don't plan on needing the workflow approval info, 
delete "AUTH_TOKEN" and any code that uses it (getDocumentInfoForTesting and 
getApprovalsForDocumentId).

To get started, search for anywhere it says "<FILL THIS IN>" and edit those values for
your situation.  When the Kuali Build form integration gets 
here, it invokes the doPost method which then formats the input and then parses 
it in the parseHPCSubmission method.

You'll need to make a dev version of your KB API integration over on 
<https://hawaii-sbx.kualibuild.com/> (Click the three vertical dots next to the KB 
logo in the header, then "Spaces and Settings," then click on the "Integrations" tab.  
Make sure you are on the UH network or VPN, it's not needed for KB prod, but it is for 
dev.  If you've changed your UH password in the last year or so, you'll likely need 
your old UH password to get in.  You'll be able to see other examples there, feel 
free to look at the "HPC Order Form Submission Test," your API should look very similar.  
Once your dev integration seems to be working with GAS, ask Cameron to copy it over to production.
You'll need to first deploy your GAS in order to get the url needed for your KB API integration.

Once the first call from Kuali Build goes through this code, go to the log (instructions 
are below), copy what you received from KB, and make a "testString" variable with that 
content (there's an example declaration at the very end of the code).  Also, take a look 
at the JSON and find the "APP_ID" and put it as the value of the constant with the same name.  
Then you can call the "doTest" method directly in GAS so you can test the code locally without going 
through a ton of KB submission.  I'd recommend working on getting the connection from 
KB to GAS going first, that way you can get the expected input to the 
doPost method and know the structure of everything so you can code it out from there.

I highly recommend setting up GASHub (Google Apps Script GitHub Assistant, 
<http://gas.a4114.net/>).  GAS doesn't have a true versioning system, so you're really 
working without a good safety net.  This Chrome extension lets you integrate GAS with 
GitHub, it's somewhat limited, but is miles ahead of what GAS provides.

General/TLDR:
1.) Someone submits an order form via Kuali Build.
2.) Kuali Build sends all the information in JSON format to this script, calling the doPost method.
3.) The doPost method parses out all the information and puts it in sheets in the 
    spreadsheet listed in "SPREADSHEET_URL" below.

To redeploy your GAS w/o the url changing:
- Click "Deploy" button
- Click "Manage deployments" from the resulting drop down menu
- Click the pencil icon for editing the deployment.
- Set "version" as "New version".
- Change the description if desired.
- Click "Deploy" button.

To see the logs of Kuali Build submissions, go to: https://console.cloud.google.com/logs/query
You will need to make a Google Cloud project and then enter that project's ID in the 
Google Cloud Platform (GCP) Project section of Project Settings for your app.
