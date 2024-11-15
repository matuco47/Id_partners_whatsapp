const knex = require("./connection");
const debug = require("../api/util").debug;
const Util = require("../api/util");

// Creates the tokenData table if it does not exist
async function createTable() {
  debug("Creating the `tokenData` table");
  const tableExists = await knex.schema.hasTable("tokenData");

  if (tableExists) {
    return;
  }

  await knex.schema.createTable("tokenData", (table) => {
    table.text("token_id").primary();
    table.text("access_token");
    table.text("token_type");
    table.integer("expires_in");
  });
}



// Adds a new token after successful authorization.
// Updates the same token with latest credentials upon re-authorization
async function add(token_id, access_token, token_type, expiry) {
  debug("Adding tokenData:", token_id);
  await knex("tokenData")
    .insert({
      token_id,
      access_token,
      token_type,
      expires_in: Date.now() + 5.184e9, // Expires in ~60 days from now
    })
    .onConflict("token_id")
    .merge(["access_token", "token_type", "expires_in"]);
}

//Removes a token from the table
async function remove(id) {
  debug("Removing token:", id);
  await knex("tokenData")
    .where({
      token_id: id,
    })
    .del();
}

// Get all tokenData
async function getAll() {
  debug("Getting all tokenData");
  return await knex("tokenData").select();
}
// Get tokenData by id
async function getById(id) {
  const user = await knex.from("tokenData").select().where("token_id", id);

  return user;
}

module.exports = {
  createTable,
  add,
  getAll,
  getById,
  remove,
};