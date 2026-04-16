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
      response_format: { type: "json_object" }, // 🔥 clave
      messages: [
        {
          role: "system",
          content: `
          Eres un asistente médico experto en emergencias.

          Convierte la transcripción en un expediente clínico estructurado.

          Devuelve SOLO JSON válido (sin markdown) con este formato exacto:

          {
            "soap": {
              "subjective": "síntomas y relato del paciente",
              "objective": "hallazgos clínicos observables",
              "assessment": "diagnóstico probable",
              "plan": "plan de manejo"
            },
            "icd10": [
              {
                "code": "código ICD-10",
                "description": "descripción"
              }
            ],
            "triage": {
              "level": "critico | urgente | moderado | leve",
              "justification": "explicación clínica breve",
              "recommended_action": "acción inmediata recomendada"
            }
          }

          Reglas de triage:
          - critico → riesgo de muerte inmediata (hemorragia, trauma severo, dolor torácico severo)
          - urgente → requiere atención rápida (dolor intenso, infección seria)
          - moderado → estable pero necesita evaluación
          - leve → no urgente

          Reglas generales:
          - Usa lenguaje médico profesional
          - No inventes datos
          - Sé consistente clínicamente
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
      medical: parsed,
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

// WEB Socket
const WebSocket = require("ws");

const wss = new WebSocket.Server({ server: app.listen(PORT) });

wss.on("connection", (ws) => {
  console.log("Cliente conectado a streaming");

  ws.on("message", async (message) => {
    try {
      // message = audio chunk (base64)
      const audioBase64 = message.toString();

      // enviar a OpenAI (simplificado streaming)
      const response = await openai.audio.transcriptions.create({
        file: Buffer.from(audioBase64, "base64"),
        model: "gpt-4o-transcribe",
        language: "es",
      });

      const texto = response.text;

      ws.send(JSON.stringify({
        type: "transcription",
        text: texto
      }));

    } catch (err) {
      console.error(err);
      ws.send(JSON.stringify({
        type: "error",
        message: err.message
      }));
    }
  });

  ws.on("close", () => {
    console.log("Cliente desconectado");
  });
});