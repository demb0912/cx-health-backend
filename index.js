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
app.post("/transcribe", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file received" });
    }

    console.log("Audio recibido:", req.file.size);

    res.json({
      status: "ok",
      message: "Audio recibido correctamente"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno" });
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