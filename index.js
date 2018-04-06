'use strict'
 
const express = require('express')
const bodyParser = require('body-parser')
const crypto = require('crypto')
const xero = require('xero-node')
const fs = require('fs')
const config = require('./xero.json')
const chp = require('chainpoint-client')
const exphbs = require('express-handlebars');

// Setup our Xero SDK (Private App Type)
if (config.privateKeyPath && !config.privateKey) 
	 config.privateKey = fs.readFileSync(config.privateKeyPath);

const xeroClient = new xero.PrivateApplication(config);
 
// Create a new instance of express
const app = express()
 
// Set the body parser options
var options = {
  type: 'application/json'
};

// Using the options above, create a bodyParser middleware that returns raw responses.
var itrBodyParser = bodyParser.raw(options)

// Setup templating & assets
var exbhbsEngine = exphbs.create({
	 defaultLayout: 'main',
	 layoutsDir: __dirname + '/views/layouts',
	 partialsDir: [
		  __dirname + '/views/partials/'
	 ],
	 helpers: {
	 	  json: function(content) {
	 	  	return JSON.stringify(content, null, 3)
	 	  },
		  ifCond: function(v1, operator, v2, options) {

				switch (operator) {
					 case '==':
						  return (v1 == v2) ? options.fn(this) : options.inverse(this);
					 case '===':
						  return (v1 === v2) ? options.fn(this) : options.inverse(this);
					 case '!=':
						  return (v1 != v2) ? options.fn(this) : options.inverse(this);
					 case '!==':
						  return (v1 !== v2) ? options.fn(this) : options.inverse(this);
					 case '<':
						  return (v1 < v2) ? options.fn(this) : options.inverse(this);
					 case '<=':
						  return (v1 <= v2) ? options.fn(this) : options.inverse(this);
					 case '>':
						  return (v1 > v2) ? options.fn(this) : options.inverse(this);
					 case '>=':
						  return (v1 >= v2) ? options.fn(this) : options.inverse(this);
					 case '&&':
						  return (v1 && v2) ? options.fn(this) : options.inverse(this);
					 case '||':
						  return (v1 || v2) ? options.fn(this) : options.inverse(this);
					 default:
						  return options.inverse(this);
				}
		  },
		  debug: function(optionalValue) {
				console.log("Current Context");
				console.log("====================");
				console.log(this);

				if (optionalValue) {
					 console.log("Value");
					 console.log("====================");
					 console.log(optionalValue);
				}
		  }
	 }
});

app.engine('handlebars', exbhbsEngine.engine);

app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');

app.use(express.static(__dirname + '/assets'));


//
// Functions
//

function generateInvoiceHash(invoice) {

	return crypto.createHmac('sha256', 'aVeryImportantSecret')
				.update(JSON.stringify(invoice.toJSON()))
				.digest('hex')
}

async function chainpointSubmit(hashes) {

	return new Promise(async (resolve, reject) => {
		console.log(hashes)

		// Retrieve 2 Chainpoint Nodes to submit our hashes to
		let nodes = await chp.getNodes(2).catch(error => console.log("Error retrieving chainpoint nodes: "+error))

		// Now send our hash to the chainpoint node
		let proofHandles = await chp.submitHashes(hashes, nodes).catch(error => console.log(error))
		console.log("Submitted Proof Objects: Expand objects below to inspect.")
		console.log(proofHandles)

		resolve(proofHandles)

	});

}

async function chainpointUpdateProofs(proofHandles, sleep=12000) {
	return new Promise(async (resolve, reject) => {

		// Sleep for, to wait for proofs to be generated
		console.log("Sleeping "+sleep+" seconds to wait for proofs to generate...")
		await new Promise(resolve => setTimeout(resolve, sleep))

		// Retrieve proofs from chainpoint
		let proofs = await chp.getProofs(proofHandles).catch(error => console.log("Error retrieving chainpoint proofs: "+error))

		console.log("Proof Objects: Expand objects below to inspect.")
		console.log(proofs)

		// if proof is not returned, we should reject the promise. Todo.
		resolve(proofs)
	})
}

async function chainpointVerifyProofs(proofs) {
	return new Promise(async (resolve, reject) => {

		// Verify every anchor in every Calendar proof
		let verifiedProofs = await chp.verifyProofs(proofs).catch(error => console.log("Error verifying chainpoint proofs: "+error))
		console.log("Verified Proof Objects: Expand objects below to inspect.")
		console.log(verifiedProofs)

		resolve(verifiedProofs)

	})
}

async function uploadHashAttachment(proofs, proofHandles, invoice) {

	return new Promise((resolve, reject) => {
		console.log("Upload Attachment")

		var fileData = { "invoice": invoice.toJSON(), "proofs": [], "proofHandles": [] }

		// Add proofs & proofHandles to file data
		proofs.map(proof => fileData['proofs'].push(proof))
		proofHandles.map(proofHandle => fileData['proofHandles'].push(proofHandle))

		var proofFilename = generateInvoiceHash(invoice)+"-cp-proofs.txt"

		fs.writeFile("./files/"+proofFilename, JSON.stringify(fileData), function(err) {
		 if(err) {
			  return console.log(err);
			  reject(err)
		 }

			console.log("The file was saved!");

			const attachmentTemplate = {
				FileName: proofFilename,
				MimeType: 'text/plain',
			 };

			 const proofFile = "./files/"+proofFilename;

			 const attachmentPlaceholder = xeroClient.core.attachments.newAttachment(
				attachmentTemplate
			 );

			 var result = attachmentPlaceholder.save(`Invoices/${invoice.InvoiceID}`, proofFile, false)

			 console.log("the file was uploaded")

			 resolve(result)

		});

	})
	
}

//
// Endpoints
// 
// Create a route that receives our webhook & pass it our itrBodyParser
app.post('/webhook', itrBodyParser, async (req, res) => {
  // We need to manually parse the body to JSON, as we've set the bodyParser to return raw responses
  var jsonBody = JSON.parse(req.body.toString());

  // Lets check the webhook signature
  console.log("Xero Signature: "+req.headers['x-xero-signature'])
  // I've created my webhookKey as a param in my Xero config file (see here: https://github.com/XeroAPI/xero-node#config-parameters)
  let hmacSignature = crypto.createHmac("sha256", config.webhookKey).update(req.body.toString()).digest("base64");
  console.log("Resp Signature: "+hmacSignature)

  // Check the signature we've generated against the signature we received
  if (req.headers['x-xero-signature'] !== hmacSignature) {
		// if the signature fails, return a 401.
		res.statusCode = 401
		res.send()
		console.log("Signature Failed: Returning response code: "+res.statusCode)

  } else {
	console.log("Handle the webhook event")

	if (jsonBody['events'].length > 0) {
		// completing them individually
		// Handle the actual event & Tierion logic here
		// Loop through our webhook events
		jsonBody['events'].forEach(function(event) {
			if (event['eventCategory'] == "INVOICE") {
				// retrieve invoice from Xero API
				xeroClient.core.invoices.getInvoice(event['resourceId'])
					.then(async function(invoice) {

						console.log(invoice.InvoiceID)
						// Hash the invoice response & send to chainpoint
						let proofHandles = await chainpointSubmit(Array(generateInvoiceHash(invoice)))
						let proofs = await chainpointUpdateProofs(proofHandles, 12000)

						// Upload as attachment
						let attachmentResult = await uploadHashAttachment(proofs, proofHandles, invoice)

						// Now we need to wait at least 90 minutes for BTC proofs / anchors to be generated
						// What we should do is create a task in a background queue
						// But I am le tired, and lazy, and cbf spinning up a database for this PoC
						// So lets take a massive shortcut and wait 7.2 million ms :-)
						let updatedProofs = await chainpointUpdateProofs(proofHandles, 7200000)
						// Upload the new attachment, over the existing.
						let updatedAttachmentResult = await uploadHashAttachment(updatedProofs, proofHandles, invoice)


					}).catch(err => {
						console.log(err);
					});;
			}
		})
	}

	res.statusCode = 200
	res.send()

  }

})

// Endpoint to view an index of Xero invoices 
app.get('/invoices', function(req, res) {
	 // Use If-Modified-Since header to show only invoices that have been updated since Feb 6th
	 xeroClient.core.invoices.getInvoices({ modifiedAfter: new Date(2018,1,10)})
		  .then(function(invoices) {
				res.render('invoices', {
					 invoices: invoices,
					 active: {
						  invoices: true,
						  nav: {
								accounting: true
						  }
					 }
				});
		  })
		  .catch(function(err) {
				handleErr(err, req, res, 'invoices');
		  })
})

// Endpoint to view changepoint history of an invoice (stored in attachment files)
app.get('/history', function (req, res) {

	var invoiceID = req.query && req.query.invoiceID ? req.query.invoiceID : null;

	if (invoiceID) {
			xeroClient.core.invoices.getInvoice(invoiceID)
				 .then(function(invoice) {
					  invoice.getAttachments()
							.then(function(attachments) {
								// We need to download the content of each attachment, convert to a json object and send to the view
								var attachmentContents = []
								// Filter our attachments by FileName to ensure we're only looking at the chainpoint proofs we previously saved
								attachments = attachments.filter((attachment) => {
									// Retrieve attachment content
									if (attachment.FileName.includes('-cp-proofs.txt')) {
										console.log("Retrieve Attachment")
										attachmentContents.push(attachment.getContent())
									}

									return attachment.FileName.includes('-cp-proofs.txt')
								})

								Promise.all(attachmentContents).then((contents) => {
									// creating an array of our proofs, which we will then verify
									var verifyProofs = []

									contents.map((content, i) => {

										try {
									        attachments[i].content = JSON.parse(content)
									        // if proofHandle is under 48 hours old, attempt to UpdateProofs
									        // if proof doesn't have btc anchor, lets request an update.  Should also check some timestamp,
									        // await chainpointUpdateProofs(attachments[i].content.proofs) 
									        // catch
									        // reject

									        // Now verify each proof & attach result (creating an array of promises)
									        verifyProofs.push(chainpointVerifyProofs(attachments[i].content.proofs))

									    } catch(e) {
									        console.log(e); // error is raised if this is a not a file of JSON content, unlikely to happen now that we're filtering out based on filename
									        attachments[i].content = null
									    }
									})

									// Resolve our verification proof promises and attach to the existing content
									Promise.all(verifyProofs).then((verifiedProofs) => {

										verifiedProofs.map((vProof,i) => {
											attachments[i].content.verifiedProofs = vProof
										})

										// Render our view
										res.render('history', {
											invoice: invoice,
											attachments: attachments,
											InvoiceID: invoiceID,
											active: {
												 invoices: true,
												 nav: {
													  accounting: true
												 }
											}
									  	});

									}).catch(function(err) {
										console.log("Error")
										console.log(err)
									})

							 	}).catch(function(err) {
							 		console.log("Error")
							 		console.log(err);
							 	});
							})
							.catch(function(err) {
								 handleErr(err, req, res, 'history');
							})
				 })
				 .catch(function(err) {
					  handleErr(err, req, res, 'history');
				 })

    	} else {
			handleErr("No History Found", req, res, 'index');
  		}
})

app.get('/', function(req, res) {
	res.render('index')
})
 
// Tell our app to listen on port 3000
app.listen(3000, function (err) {
  if (err) {
	 throw err
  }
 
  console.log('Server started on port 3000')
})