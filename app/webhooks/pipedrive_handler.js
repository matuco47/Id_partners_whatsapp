const Router = require("express").Router;
const router = new Router();
const multer = require("multer");
const util = require("../api/util");
const fs = require("fs");
const path = require("path");
const faceToken = require("../db/tokenData");
const What_user = require("../db/what_user");
const debug = util.debug;
const upload = multer().any();
// This endpoint responds with a message 'id' which should be unique.
// Currently this is mocked by appending current timestamp.
// We also prefix it with 'pd' to identify the message type and associate it with a dummy sender.
router.post(
  "/channels/:providerChannelId/messages",
  upload,
  async (req, res) => {
    const msg_body = req.body;
    const message = msg_body.message,
    recipient = msg_body.recipientIds[0];
    const file = req.files[0];
    debug("Incoming message from Pipedrive");
    try {
      if (file) {
        const mediaId = await util.getMediaId(file,req.tokenData[0].access_token);
        await util.sendDocumentToWa(mediaId.id, file.originalname, recipient, req.tokenData[0].not_first?req.tokenData[0].accesToken:process.env.WA_TOKEN);
      } else{
        await util.sendMessageToWA(message, recipient, req.tokenData[0].not_first?req.tokenData[0].accesToken:process.env.WA_TOKEN);
      }
      const templates=await util.getTemplate(req.tokenData[0].accesToken);
      let messageId = "msg-pd-" + Date.now();
      debug("Message sent to WhatsApp. Responding with message ID," + messageId);
      res.send({
        success: true,
        data: {
          id: messageId,
        },
      });
    } catch (e) {
      debug("Error while sending message to WhatsApp" , e);
      res.sendStatus(500);
    }
  }
);

module.exports = router;
