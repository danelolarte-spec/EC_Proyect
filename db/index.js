const db = require('./connection');
const { runMigrations } = require('./migrations');
const { createSchema } = require('./schema');
const { seed } = require('./seed');

runMigrations(db);
createSchema(db);
seed(db);

module.exports = db;
