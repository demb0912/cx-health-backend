const express = require("express");
const multer = require("multer");
const cors = require("cors");
const OpenAI = require("openai");
const { toFile } = require("openai/uploads");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// CORS
app.use(cors({ origin: "*" }));
app.options("*", cors());

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ENDPOINT
app.post("/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file received" });
    }

    console.log("Procesando audio con OpenAI...");

    // 1. TRANSCRIPCIÓN
    const file = await toFile(req.file.buffer, "audio.webm");

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "gpt-4o-transcribe",
      language: "es",
    });

    const texto = transcription.text;

    console.log("Texto base:", texto);

    // 2. ESTRUCTURAR COMO EXPEDIENTE MÉDICO
    const structured = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Eres un asistente médico. Convierte transcripciones en expedientes clínicos estructurados.

Devuelve JSON con:
- motivo_consulta
- sintomas
- diagnostico_probable
- observaciones
`,
        },
        {
          role: "user",
          content: texto,
        },
      ],
    });

    // const result = structured.choices[0].message.content;
    let result = structured.choices[0].message.content;

    // limpiar markdown ```json
    result = result.replace(/```json|```/g, "").trim();

    // convertir a objeto real
    //const parsed = JSON.parse(result);
    let parsed;

    try {
      parsed = JSON.parse(result);
    } catch (e) {
      console.error("Error parseando JSON:", result);
      parsed = { raw: result };
    }

    res.json({
      status: "ok",
      raw: texto,
      structured: parsed,
    });

  } catch (error) {
    console.error("ERROR:", error);

    res.status(500).json({
      error: "Error en transcripción",
      detail: error.message,
    });
  }
});

// HEALTH CHECK
app.get("/", (req, res) => {
  res.send("OK");
});

// PORT
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});