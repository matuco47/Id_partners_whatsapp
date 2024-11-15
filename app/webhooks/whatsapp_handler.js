const Router = require("express").Router;
const router = new Router();
const util = require("../api/util");
const what_user = require("../db/what_user");
const debug = util.debug;
// [🔴 IMPORTANT] 
// For production-ready apps, please follow the instructions mentioned in the link below
// https://developers.facebook.com/docs/whatsapp/cloud-api/get-started#configure-webhooks
// Similarly, WhatsApp has a retry logic. Make sure you respond with an appropriate status code


// You need to verify webhook registration or else it will not be registered
router.get("/whatsapp/messages/hook", async (req, res) => {
    debug("WhatsApp hook verified. You should be able to receive incoming messages");
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query["hub.challenge"];
    if(mode && token==="intentemos"){
      debug("funca?");
    }
    res.send(challenge);
});

// Parse the incoming message and send it to Pipedrive
// NB! Beware of WhatsApp's retry logic - for now, the endpoint is configured to return *success* no matter what
router.post("/whatsapp/messages/hook", async (req, res) => {
    if (req.body.object) {
        if (
            req.body.entry &&
            req.body.entry[0].changes &&
            req.body.entry[0].changes[0] &&
            req.body.entry[0].changes[0].value.messages &&
            req.body.entry[0].changes[0].value.messages[0]
        ) {
            let message = req.body.entry[0].changes[0].value.messages[0];
            let from = message.from; // extract the phone number from the webhook payload
            let msg_body;
            let profile = req.body.entry[0].changes[0].value.contacts[0].profile.profile_pic;
            let name=req.body.entry[0].changes[0].value.contacts[0].profile.name;
            if (message.type === 'text') {
                msg_body = message.text.body; // extract the message text from the webhook payload
            }else if(message.type==='button'){
              msg_body = message.button.text; //extract the message from the button
            }else {
                msg_body = `Sent [${message.type}]`;
            }
            let msg_time = message.timestamp; // extract the message timestamp from the webhook payload
            try {
                debug(`Incoming message from ${from}, ${name}.Forwarding message to Pipedrive...`);
                // This line adds/updates a user on recieve message (use to get data for mock response)
                await what_user.add(`sender-wa-${from}`,name,profile,false);
                await util.sendMessageToPD(
                    req.user.access_token,
                    from,
                    msg_body,
                    msg_time,
                    name
                );                
                debug(`Message forwarded to Pipedrive successfully`);
                res.sendStatus(200);
            } catch (e) {
                debug(`Oopsie, couldn't forward message to Pipedrive.`, e)
                res.sendStatus(200);
            }
        }
    } else {
        res.sendStatus(200);
    }
});

module.exports = router;