const Router = require("express").Router;
const router = new Router();
const { faker } = require("@faker-js/faker");
const debug = require("../util").debug;
const Channel = require("../../db/channel");
const User = require("../../db/user");
const Util = require("../util");
const What_User = require("../../db/what_user");

// Generates mock responses for provider endpoints
// We are using `faker` to generate dummmy data
// For `getConversations` provider endpoint
router.get("/channels/:providerChannelId/conversations", async (req, res) => {
  debug("Serving data for `getConversations`");
  const response = {
    success: true,
    data: [],
    additional_data: {
      after: "c-next",
    },
  };
  res.send(response);
});

// For `getConversationById` provider endpoint
router.get(
  "/channels/:providerChannelId/conversations/:sourceConversationId",
  async (req, res) => {
    debug("Serving data for `getConversationById`");
    // Geting data from the pipedrive user
    const user_data = await User.getCurrent();
    const pipe_user = await Util.getUser(user_data.access_token);
    // Geting data From the Whatsapp user
    const what_user = await What_User.getById(
      `sender-wa-${req.params.sourceConversationId.split("-")[1]}`
    );
    if (!what_user[0].last_send) {
      debug("Sending welcome message");
      try {
        const templates = await Util.getTemplate(req.tokenData[0].access_token);
        let sendTemplate = null,
          done = false;
        templates.data.forEach((template) => {
          let name = template.name.split("_")[0];
          if ((name == "bienvenida" || name == "welcome" || name == "bienvenido") && !done) {
            sendTemplate = template;
            done = true;
          }
        });
        sendTemplate ? await Util.sendTemplate(req.tokenData[0].access_token,what_user[0].what_user_id,sendTemplate) : debug("no hay template");
      } catch (e) {
        debug(e);
      }
    }
    const response = {
      success: true,
      data: {
        id: `${req.params.sourceConversationId}`,
        link: `https://example.com/${req.params.providerChannelId}/${req.params.sourceConversationId}`,
        status: "open",
        seen: false,
        next_messages_cursor: null, // To avoid fetching the next set of messages
        messages: [],
        participants: [
          {
            id: "sender-pd-1",
            name: pipe_user.data.company_name,
            role: "source_user",
            avatar_url: pipe_user.data.icon_url,
            fetch_avatar: true,
            avatar_expires: false,
          },
          {
            id: what_user[0].what_user_id,
            name: what_user[0].name,
            role: "end_user",
            avatar_url: what_user[0].avatar_url
              ? what_user[0].avatar_url
              : `https://www.gravatar.com/avatar/${faker.random.alpha(
                  20
                )}?d=robohash`,
            fetch_avatar: true,
            avatar_expires: false,
          },
        ],
      },
      additional_data: {
        after: "c-next",
      },
    };
    res.send(response);
  }
);

// For `getMessageById` provider endpoint
router.get(
  "/channels/:providerChannelId/messages/:sourceMessageId",
  (req, res) => {
    debug("Serving mock data for `getMessageById`");
    let sender = req.params.sourceMessageId;
    sender = sender.includes("wa") ? `sender-wa-dummynumber` : "sender-pd-1";
    const fake_response = {
      id: `${req.params.sourceMessageId}`,
      status: "sent",
      created_at: new Date(Date.now()).toISOString(),
      message: faker.hacker.phrase(),
      sender_id: sender,
      reply_by: new Date(Date.now() + 3.156e10).toISOString(), // an year from now
      attachments: [],
    };
    res.send(fake_response);
  }
);

// For `getMessageById` provider endpoint
router.get(
  "/channels/:providerChannelId/conversations/:sourceConversationId/messages/:sourceMessageId",
  (req, res) => {
    debug("Serving mock data for `getMessageById`");
    let sender = req.params.sourceMessageId;
    sender = sender.includes("wa") ? `sender-wa-dummynumber` : "sender-pd-1";
    const fake_response = {
      id: `${req.params.sourceMessageId}`,
      status: "sent",
      created_at: new Date(Date.now()).toISOString(),
      message: faker.hacker.phrase(),
      sender_id: sender,
      reply_by: new Date(Date.now() + 3.156e10).toISOString(), // an year from now
      attachments: [],
    };
    res.send(fake_response);
  }
);

// For `getSenderById` provider endpoint
router.get("/channels/:providerChannelId/senders/:senderId", (req, res) => {
  debug("Serving mock data for `getSenderById`");
  const fake_response = {
    success: true,
    data: {
      id: `${req.params.senderId}`,
      name: faker.name.findName(),
      avatar_url: `https://www.gravatar.com/avatar/${faker.random.alpha(
        20
      )}?d=robohash`,
    },
  };

  res.send(fake_response);
});

// For `getTemplates` provider endpoint
router.get("/channels/:providerChannelId/templates", async (req, res) => {
  debug("Serving data for `getTemplates`");
  const templates = await Util.getTemplate(
    req.tokenData[0].access_token,
    false
  );
  const response = {
    success: templates ? true : false,
    data: {
      templates: templates.data,
    },
  };
  res.send(response);
});

router.delete("/channels/:providerChannelId", async (req, res) => {
  debug("Deleting channel by id: " + req.params.providerChannelId);
  try {
    await Channel.remove(req.params.providerChannelId);
    debug("Channel deleted");
    res.send({ success: true });
  } catch (e) {
    debug("Failed to delete channel");
    debug(e);
    res.send({ success: false });
  }
});

module.exports = router;
