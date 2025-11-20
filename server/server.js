const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { initDb, saveResult, getResultById } = require("./db");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 1234;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/data", express.static(path.join(__dirname, "..", "data")));

function validatePayload(body) {
  if (!Array.isArray(body.answers) || body.answers.length === 0) {
    return "answers are required";
  }
  if (!body.scores || typeof body.scores !== "object") {
    return "scores are required";
  }
  return null;
}

app.post("/api/results", async (req, res) => {
  try {
    const error = validatePayload(req.body || {});
    if (error) {
      return res.status(400).json({ status: "error", message: error });
    }

    const {
      name = null,
      email = null,
      telegram = null,
      purpose = null,
      answers,
      scores,
      topArchetypes = [],
    } = req.body;

    const id = await saveResult({
      name,
      email,
      telegram,
      purpose,
      answers,
      scores,
      topArchetypes,
    });

    res.json({ status: "ok", id });
  } catch (err) {
    console.error("Failed to save result", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

app.get("/api/results/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ status: "error", message: "Invalid id" });
    }

    const row = await getResultById(id);
    if (!row) {
      return res.status(404).json({ status: "not_found" });
    }

    res.json({ status: "ok", result: row });
  } catch (err) {
    console.error("Failed to fetch result", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

async function sendEmailReport({ to, result }) {
  // Заглушка: тут можна підключити реальний SMTP через nodemailer
  console.log("Email report queued for", to, result.id);
  return { status: "queued" };
}

async function sendTelegramReport({ handle, result }) {
  // Заглушка: тут можна викликати Telegram Bot API
  console.log("Telegram report queued for", handle, result.id);
  return { status: "queued" };
}

app.post("/api/send-report", async (req, res) => {
  try {
    const { resultId, email, telegram } = req.body || {};
    if (!resultId) {
      return res
        .status(400)
        .json({ status: "error", message: "resultId is required" });
    }
    if (!email && !telegram) {
      return res
        .status(400)
        .json({ status: "error", message: "Provide email or telegram" });
    }

    const result = await getResultById(resultId);
    if (!result) {
      return res.status(404).json({ status: "error", message: "Not found" });
    }

    const responses = [];
    if (email) {
      responses.push(await sendEmailReport({ to: email, result }));
    }
    if (telegram) {
      responses.push(await sendTelegramReport({ handle: telegram, result }));
    }

    res.json({ status: "ok", deliveries: responses });
  } catch (err) {
    console.error("Failed to send report", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Money DNA server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to init DB", err);
    process.exit(1);
  });
