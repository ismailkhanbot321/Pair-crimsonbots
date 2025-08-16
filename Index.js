import express from "express";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";

const app = express();
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("🚀 Pair Code Generator is running! Use POST /getcode with your number.");
});

// Generate Pair Code
app.post("/getcode", async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).send({ error: "Provide number in body {number: '92XXXXXXXXX'}" });

    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${number}`);
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
    });

    if (!sock.authState.creds.registered) {
      let code = await sock.requestPairingCode(number);
      res.send({ number, code });
    } else {
      res.send({ message: "Already registered!" });
    }

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Download session as .zip
app.get("/download/:number", (req, res) => {
  const number = req.params.number;
  const folderPath = `./sessions/${number}`;

  if (!fs.existsSync(folderPath)) {
    return res.status(404).send({ error: "Session not found" });
  }

  const zipFile = path.join("./", `${number}.zip`);
  const output = fs.createWriteStream(zipFile);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    res.download(zipFile, `${number}.zip`, (err) => {
      if (!err) fs.unlinkSync(zipFile); // delete after download
    });
  });

  archive.pipe(output);
  archive.directory(folderPath, false);
  archive.finalize();
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
