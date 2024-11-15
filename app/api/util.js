// Setting this environment variable allows us have detailed logs
process.env.DEBUG = "app";

const request = require("request-promise");
const debug = require('debug')('app');
const querystring = require('querystring');
debug.log = console.info.bind(console);

//Get basic details about the user by calling `users/me` endpoint env
async function getUser(accessToken) {
    debug("Retrieving user details using the access token");
    const requestOptions = {
        uri: "https://api.pipedrive.com/v1/users/me",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        json: true,
    };
    const userInfo = await request(requestOptions);

    return userInfo;
}

// Create a messaging channel in Pipedrive
async function createChannel(accessToken, id, name, type) {
    
    const requestOptions = {
        uri: "https://api.pipedrive.com/v1/channels",
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        body: {
            name: name,
            provider_channel_id: id,
            avatar_url: 'https://robohash.org/mxtouwlpxqjqtxiltdui?set=set1&bgset=&size=48x48',
            provider_type: type
        },
        json: true,
    };
    const response = await request(requestOptions);
    debug("Channel created!");

    return response;
}

// Forward message to WhatsApp using their Graph API
async function sendMessageToWA(msg, recipientId,token) {
    debug("Sending a whatsapp message based on data received from Pipedrive");
    const requestOptions = {
        uri: `https://graph.facebook.com/v13.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
        },
        json: {
            messaging_product: "whatsapp",
            to: recipientId.split('wa-')[1],
            type: "text",
            text: {
                preview_url: true,
                body: msg,
            },
        },
    };
  try{
    const response = await request(requestOptions);
    debug("Message sent to WhatsApp from Pipedrive");
    return response;
  }catch(e){
    debug("Failed to sent message to Whatsapp from Pipedrive");
    debug(e);
    throw e;
  }
}

// Get´s the media Id of meta from an document
// This Id is use later to send the document in a message 
async function getMediaId(file, accessToken){
  debug("Geting the media id from whatsapp");
  const form={
    messaging_product: "whatsapp",
    file:{
      value:file.buffer,
      options:{
        filename:file.originalname,
        contentType:file.mimetype
      }
    }
  };
  const requestOptions = {
    uri:`https://graph.facebook.com/v13.0/${process.env.WA_PHONE_NUMBER_ID}/media`,
    method:"POST",
    headers:{
      'Authorization': `Bearer ${accessToken}`
    },
    formData:form,
    json:true
  };
  try{
    const response=await request(requestOptions);
    debug("Media id succesfuly got");
    return response;
  }catch(e){
    debug("Fail requesting media Id");
    debug(e);
    throw e;
  }
}

// Function to send a document to Whatsapp
async function sendDocumentToWa(mediaId,fileName, recipientId,token) {
  debug("Sending a whatsapp document from pipedrive")
  const requestOptions = {    
    uri: `https://graph.facebook.com/v13.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    json: {
      messaging_product: "whatsapp",
      to: recipientId.split('wa-')[1],
      type: "document",
      document: {
        id: mediaId,
        filename: fileName,
      },
    },
  };
  try{
    const response=await request(requestOptions);
    debug("Document sended to Whatsapp from Pipedrive");
    return response;
  }catch(e){
    debug("Failed to forward document");
    debug(e);
    throw e;
  }
}

// Forward message to Pipedrive Messaging Inbox using Channels API
async function sendMessageToPD(accessToken, from, msg, time,name) {
    debug("Sending a Pipedrive Inbox message based on data from WhatsApp chat:", msg);
    const requestOptions = {
        uri: "https://api.pipedrive.com/v1/channels/messages/receive",
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        body: {
            id: "msg-wa-" + Date.now(),
            channel_id: process.env.CHANNEL_ID,
            conversation_id: `conversation-${from}`,
            sender_id: `sender-wa-${from}`,
            sender_name:name,
            message: msg,
            status: "sent",
            created_at: new Date(parseInt(time) * 1000).toISOString().replace("T", " ").substring(0, 16),
            attachments: [],
        },
        json: true,
    };
    try{
      const status = await request(requestOptions);
      debug("Message sent to Pipedrive from WhatsApp");
      return status;
    }catch (e){
      debug("Failed to send message to Pipedrive from Whatsapp");
      debug(e);
      throw e;
    }
}

// Figure out the domain in which the app is running
async function getAppDomain(port = 3000) {
    let domain;
    if (process.env.PROJECT_DOMAIN) {
        domain = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
    } else {
        domain = `http://localhost:${port}`;
    }
    return domain;
}

// Dynamically generate the manifest.json file
function generateManifest(domain) {
    return {
        version: "v202101",
        endpoints: {
            getConversations: `${domain}/channels/:providerChannelId/conversations`,
            getConversationById: `${domain}/channels/:providerChannelId/conversations/:sourceConversationId`,
            postMessage: `${domain}/channels/:providerChannelId/messages`,
            getSenderById: `${domain}/channels/:providerChannelId/senders/:senderId`,
            deleteChannelById: `${domain}/channels/:providerChannelId`,
            getTemplates: `${domain}/channels/:providerChannelId/templates`,
            getMessageById: `${domain}/channels/:providerChannelId/conversations/:sourceConversationId/messages/:sourceMessageId`,
        },
    };
}

// Calculate access token expiry in minutes
function getAccessTokenExpiry(expiry_ts,prevent) {
    const remaining_minutes = parseInt((parseInt(expiry_ts) - parseInt(Date.now())) / (1000 * 60));
    return {
        expired: prevent?(remaining_minutes <=14400):(remaining_minutes <= 0),
        remaining_minutes
    }
}


// Refreshes the pipedrive token
async function refreshAccessToken(refresh_token){
  const credentials = `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`;
  const encodedCredentials = Buffer.from(credentials).toString('base64');
  const requestBody = querystring.stringify({
        grant_type: "refresh_token",
        refresh_token: refresh_token
  });
  const requestOptions = {
        uri: "https://oauth.pipedrive.com/oauth/token",
        method: "POST",
        headers: {
            Authorization: `Basic ${encodedCredentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: requestBody,
        json: true,
  };
  try{
    const refreshed=await request(requestOptions);
    debug("Pipedrive token refreshed with success");
    return refreshed;
  }catch (e){
    debug("Failed to refresh Pipedrive Token");
    debug(e);
    throw e;
  }
}


// Creates a meta token (this can´t be refreshed so they are created again)
async function generateTokenFacebook(metaToken){
  const requestBody={
    uri:`https://graph.facebook.com/v17.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.WA_APP_ID}&client_secret=${process.env.WA_APP_SECRET}&fb_exchange_token=${metaToken}`,
    headers: {
            Authorization: `Bearer ${metaToken}`,
        },
    json: true
  };
  try{
    const response=await request(requestBody);
    debug("Whatsapp token generated with success");
    return response;
  }catch(e){
    debug("Failed to generate Whatsapp token");
    debug(e);
    throw e;
  }
}

// Gets the templates/template this functions whit or whitout the template id
async function getTemplate(metaToken,templateId){
  const requestBody={
    uri:templateId?
    `https://graph.facebook.com/v13.0/${templateId}`:
    `https://graph.facebook.com/v13.0/${process.env.WABA_ID}/message_templates`,
    headers:{
      Authorization: `Bearer ${metaToken}`
    },
    json: true
  };
  try{
    debug("Geting templates to send");
    const response=await request(requestBody);
    return response
  }catch(e){
    debug("Failed to get templates");
    debug(e);
    return false;
  }
}

//Sends the template to whatsapp
async function sendTemplate(metaToken,recipientId,template){
  const requestBody={
    uri:`https://graph.facebook.com/v13.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
    method:"POST",
    headers:{
      Authorization: `Bearer ${metaToken}`
    },
    json:{
      messaging_product: "whatsapp",
      to: recipientId.split('wa-')[1],
      recipient_type: "individual",
      type: "template",
      template:{
        name:template.name,
        language:{code:template.language},
        components:template.components.
        filter(component => ["BODY", "BUTTONS", "CAROUSEL", "HEADER", "LIMITED_TIME_OFFER", "ORDER_STATUS"].includes(component.type))
        .flatMap((component,i=0)=>{
          
          debug(component,"componente");
          let finalComp=null
          if(component.type==="BUTTONS"){
            
           return component.buttons.map((button,index)=>{
                if(button.type==="QUICK_REPLY"){
                  return{
                    type:"BUTTON",
                    sub_type:button.type,
                    index:index
                  };
                }else{return "";} 
              });
            
          }else{
            finalComp={
            type:component.type,
            };            
          }
          debug(finalComp,"final");
          return finalComp;
        }),
      }
    }
  };
  try{
    debug("Sending template ");
    const response=await request(requestBody);
    return response
  }catch (e){
    debug("Failed to send template");
    debug(e);
    throw e;
  }
}

module.exports = {
    debug,
    getUser,
    getAppDomain,
    getAccessTokenExpiry,
    generateManifest,
    createChannel,
    sendMessageToWA,
    sendMessageToPD,
    refreshAccessToken,
    generateTokenFacebook,
    sendDocumentToWa,
    getMediaId,
    getTemplate,
    sendTemplate
};