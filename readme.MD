## Check the blog: https://medium.com/p/be423d39380b

## Xero & Tierion Example Application

This example application shows how the Tierion network can be used to anchor accounting records to provide an immutable audit trail.

Read a detailed background on this project <a href="https://medium.com/p/be423d39380b">on the blog</a>.

### How to use:

1.  Create Private App in [Xero Developer Portal](https://developer.xero.com/myapps/) (Hint: create your private app against the [Demo Company](https://developer.xero.com/documentation/getting-started/development-accounts))
2.  Start ngrok `./ngrok http 3000`
3.  Config Xero Webhooks (enter https ngrok endpoint)
4.  Create xero.json (credentials) file in XeroTierion Node App, [see example](https://gist.github.com/rjaus/4a481ce761dd581b96345ee84dc1e4f3)
5.  Start the node application `node index.js`
6.  Login to Xero and make a change to an invoice, or create a new invoice: [Link to Xero](https://login.xero.com/)
7.  Wait approximately 10 seconds for webhook event to fire & node app to process it
8.  Optional: Watch [ngrok web console](http://127.0.0.1:4040) to see when webhook is processed
9.  Use menu to view a [list of your invoices in Xero](/invoices)
10.  Click 'view history', to see the audit history of an invoice

### Overview of Tierion / Chainpoint:

![What is Tierion & Chainpoint](https://tierion.com/Content/images/site/features/hashapi-diagram.png)

### Resources:

*   Xero API: [https://developer.xero.com/](https://developer.xero.com/)
*   Tierion: [https://tierion.com/](https://tierion.com/)
*   Chainpoint: [https://chainpoint.org/](https://chainpoint.org/)
*   Xero Node SDK: [https://github.com/XeroAPI/xero-node](https://github.com/XeroAPI/xero-node)

Explore the github repo: [https://github.com/rjaus/XeroTierion](https://github.com/rjaus/XeroTierion)

Read the full blog post on medium: [https://medium.com/p/be423d39380b](https://medium.com/p/be423d39380b)

### Project created by Riley James

*   Twitter: [https://twitter.com/RileyJamesAU](https://twitter.com/RileyJamesAU)
*   Medium: [https://medium.com/@riley.james](https://medium.com/@riley.james)
*   Github: [https://github.com/rjaus](https://github.com/rjaus)
*   Linkedin: [https://www.linkedin.com/in/rileyjames/](https://www.linkedin.com/in/rileyjames/)