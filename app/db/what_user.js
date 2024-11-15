const knex = require("./connection");
const debug = require("../api/util").debug;
const axios = require("axios");

// Creates the what_user table if it does not exist
async function createTable() {
  debug("Creating the `what_user` table");
  const tableExists = await knex.schema.hasTable("what_user");
  if (tableExists) {
    return;
  }

  await knex.schema.createTable("what_user", (table) => {
    table.text("what_user_id").primary();
    table.text("name");
    table.text("avatar_url");
    table.text("last_send");
  });
}

// Adds a new user after successful authorization.
// Updates the same user with latest credentials upon re-authorization
async function add(what_user_id, name, avatar_url, last_send) {
  debug("Adding what_user:", what_user_id);
  await knex("what_user")
    .insert({
      what_user_id,
      name,
      avatar_url,
      last_send:true
    })
    .onConflict("what_user_id")
    .merge(["name", "avatar_url","last_send"]);
}

//Removes an user from the table
async function remove(id) {
  debug("Removing user:", id);
  await knex("what_user")
    .where({
      what_user_id: id,
    })
    .del();
}

// Get all what_user
async function getAll() {
  debug("Getting all what_user");
  return await knex("what_user").select();
}
// Get what_user by id
async function getById(id) {
  debug("Getting user:", id);
  const user = await knex.from("what_user").select().where("what_user_id", id);

  return user;
}




module.exports = {
  createTable,
  add,
  getAll,
  getById,
  remove
};
