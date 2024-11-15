const express = require("express");
const path = require("path");
const passport = require("passport");
const OAuth2Strategy = require("passport-oauth").OAuth2Strategy;

const util = require("./api/util");
const debug = util.debug;

const User = require("./db/user");
const Channel = require("./db/channel");
const What_User = require("./db/what_user");
const FaceToken = require("./db/tokenData");
const bodyParser = require("body-parser");

// Core API routes
const core_api = require("./api/core");

// Provider and Manifest related endpoints
const manifest_router = require("./api/provider/manifest_generator");
const provider_router = require("./api/provider/mock_response_generator");

// Webhook Handlers
const pd_message_handler = require("./webhooks/pipedrive_handler");
const whatsapp_message_handler = require("./webhooks/whatsapp_handler");

debug("Loading environment variables");
require("dotenv").config();

debug("Starting the app");
// Creates all the tables
User.createTable();
What_User.createTable();
Channel.createTable();
FaceToken.createTable();

const app = express();
process.env.PORT = 3000;

debug("Configuring Passport for OAuth2");
passport.use(
  "pipedrive",
  new OAuth2Strategy(
    {
      authorizationURL: "https://oauth.pipedrive.com/oauth/authorize",
      tokenURL: "https://oauth.pipedrive.com/oauth/token",
      clientID: process.env.CLIENT_ID || "<CLIENT_ID>",
      clientSecret: process.env.CLIENT_SECRET || "<CLIENT_SECRET>",
      callbackURL: process.env.CALLBACK_URL || "<CALLBACK_URL>",
    },
    async (accessToken, refreshToken, profile, done) => {
      const userInfo = await util.getUser(accessToken);
      const user = await User.add(userInfo.data.id, accessToken, refreshToken);
      done(null, { user });
    }
  )
);
debug("Rendering static content with handlebars");
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// parse application/json
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, "public")));
app.use(passport.initialize());

app.use(async (req,res,next)=>{
  req.user = await User.getCurrent();
  req.tokenData= await FaceToken.getById(0);
  //debug(`${req.method} : ${req.originalUrl}`);
  next();
})

// Verifies pipedrive token on message recieve from Whatsapp
app.use("/whatsapp/messages/hook", async (req, res, next) => {
  req.user = await User.getCurrent();
  if(req.user.refresh_token){
  try {
    const expiry = await util.getAccessTokenExpiry(req.user.expiry, false);
    if (expiry.expired) {
      const refreshed = await util.refreshAccessToken(req.user.refresh_token);
      User.add(
        req.user.user_id,
        refreshed.access_token,
        refreshed.refresh_token,
        refreshed.expires_in
      );
      req.user = {
        user_id: req.user.user_id,
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expiry: Date.now() + 3.54e6,
      };
      debug("Token refreshed with success ")
    }
  } catch (e) {
    debug("Something failed check where " , e);
  }}
  next();
});

// Verifies meta token on message send from Pipedrive
app.use("/channels/:providerChannelId/messages", async (req, res, next) => {
  req.tokenData=[];
  let tokenData = await FaceToken.getById(0);
  req.tokenData[0] =tokenData[0]?{
    token_id:tokenData[0].token_id,
    accesToken: tokenData[0].access_token,
    token_type: tokenData[0].token_type,
    expires_in: tokenData[0].expires_in,
    not_first: true
  }:null;
  try {
    debug("Controling expire");
    const expiry = await util.getAccessTokenExpiry(tokenData[0]?tokenData[0].expires_in:0,true);
    debug(expiry);
    if (expiry.expired) {
      debug("Renovating facebook token");
      const newToken = await util.generateTokenFacebook(tokenData[0]? tokenData[0].access_token:process.env.WA_TOKEN);
      FaceToken.add(
        0,
        newToken.access_token,
        newToken.token_type,
        newToken.expires_in
      );
      req.tokenData[0] = {
        token_id: 0,
        accesToken: newToken.access_token,
        token_type: newToken.token_type,
        expires_in: Date.now() + 5.184e9,
        not_first: req.tokenData[0]?true:false
      };
    }
  } catch (e) {
    debug("Something failed check where " , e);
  }
  debug("Revition ended");
  next();
});

app.get("/auth/pipedrive", passport.authenticate("pipedrive"));
app.get(
  "/auth/pipedrive/callback",
  passport.authenticate("pipedrive", {
    session: false,
    failureRedirect: "/",
    successRedirect: "/",
  })
);

// Core API
debug("Loading API routes");
app.use(core_api);

// API pertaining to webhooks that handle incoming messages from either Pipedrive / Provider.
app.use(pd_message_handler);
app.use(whatsapp_message_handler);
app.use(provider_router);
app.use(manifest_router);

// Let's start the server 💪
app.listen(process.env.PORT, async () => {
  debug("Figuring out the app's domain");
  const domain = await util.getAppDomain(process.env.PORT);
  console.log(`🟢 App has started.`);
  console.log(`🔗 Live URL: ${domain}/`);
  console.log(`🔗 CallBack URL: ${domain}/auth/pipedrive/callback`);
  console.log(`🔗 Manifest URL: ${domain}/manifest.json`);
});
