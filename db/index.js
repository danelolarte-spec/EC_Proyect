const db = require('./connection');
const { createSchema } = require('./schema');
const { seed } = require('./seed');

createSchema(db);
seed(db);

module.exports = db;
