const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const DB_PATH = path.join(__dirname, "..", "data", "moneydna.sqlite");

let dbPromise;

async function initDb() {
  if (!dbPromise) {
    dbPromise = open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
  }

  const db = await dbPromise;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now')),
      name TEXT,
      email TEXT,
      telegram TEXT,
      purpose TEXT,
      answers_json TEXT NOT NULL,
      scores_json TEXT NOT NULL,
      top_archetypes_json TEXT NOT NULL
    );
  `);

  return db;
}

async function saveResult({
  name = null,
  email = null,
  telegram = null,
  purpose = null,
  answers,
  scores,
  topArchetypes
}) {
  if (!Array.isArray(answers) || !scores) {
    throw new Error("answers and scores are required");
  }

  const db = await initDb();
  const result = await db.run(
    `
      INSERT INTO results (
        name,
        email,
        telegram,
        purpose,
        answers_json,
        scores_json,
        top_archetypes_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      name,
      email,
      telegram,
      purpose,
      JSON.stringify(answers),
      JSON.stringify(scores),
      JSON.stringify(topArchetypes || [])
    ]
  );

  return result.lastID;
}

async function getResultById(id) {
  const db = await initDb();
  const row = await db.get(
    `
      SELECT
        id,
        created_at as createdAt,
        name,
        email,
        telegram,
        purpose,
        answers_json as answersJson,
        scores_json as scoresJson,
        top_archetypes_json as topArchetypesJson
      FROM results
      WHERE id = ?
    `,
    id
  );

  if (!row) return null;

  return {
    id: row.id,
    createdAt: row.createdAt,
    name: row.name,
    email: row.email,
    telegram: row.telegram,
    purpose: row.purpose,
    answers: JSON.parse(row.answersJson),
    scores: JSON.parse(row.scoresJson),
    topArchetypes: JSON.parse(row.topArchetypesJson)
  };
}

module.exports = {
  initDb,
  saveResult,
  getResultById
};
