const express = require("express");
const multer = require("multer");
const cors = require("cors");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ CORS correcto
app.use(cors({
  origin: "*"
}));

app.options("*", cors());

// Endpoint
const axios = require("axios");

app.post("/transcribe", upload.single("file"), async (req, res) => {
  try {
    // 1. validar que llegó archivo
    if (!req.file) {
      return res.status(400).json({ error: "No file received" });
    }

    console.log("Procesando audio...");

    // 2. convertir audio a base64
    const audioBase64 = req.file.buffer.toString("base64");

    // 3. enviar audio a Google
    const response = await axios.post(
      `https://speech.googleapis.com/v1/speech:recognize?key=${process.env.GOOGLE_API_KEY}`,
      {
        config: {
          encoding: "WEBM_OPUS",
          languageCode: "es-ES"
        },
        audio: {
          content: audioBase64
        }
      }
    );

    // 4. sacar el texto
    const transcript =
      response.data.results?.[0]?.alternatives?.[0]?.transcript || "";

    console.log("Texto:", transcript);

    // 5. devolver resultado
    res.json({
      status: "ok",
      transcript
    });

  } catch (error) {
    console.error("ERROR:", error.response?.data || error.message);

    res.status(500).json({
      error: "Error en transcripción",
      detail: error.response?.data || error.message
    });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("OK");
});

// 🔥 CRÍTICO
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});