require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const FYI_URL = process.env.FYI_URL;
const ACCESS_ID = process.env.FYI_ACCESS_KEY;
const SECRET_KEY = process.env.FYI_SECRET_KEY;
const CLIENT_CODE = process.env.FYI_CLIENT_CODE;

const upload = multer({ dest: "uploads/" });
const app = express();



const cors = require("cors");

app.use(cors({
  origin: "*", // allow all origins
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

// ✅ Serve static frontend files (HTML, CSS, JS) from "public" folder
app.use(express.static(path.join(__dirname, "public")));

// ✅ Upload API route
app.post("/api/upload", upload.single("pdf"), async (req, res) => {
  try {
    const metadata = JSON.parse(req.body.data);
    const filePath = req.file.path;

     // 🔎 Debug logs before Step 1
    console.log("Headers being sent:", {
      "x-fyi-access-id": ACCESS_ID,
      "x-fyi-access-secret": SECRET_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json"
    });

    console.log("Payload being sent:", {
      metadata: {
        action: { value: "upsert" },
        data: {
          model: {
            name: "Arvin_Test_Documents",
            document_type: "Pdf",
           
          },
        },
      },
    });



    // Step 1: Create document record
    console.log("Calling FYI Docs at:", `${FYI_URL}/external/document`);
    const createRes = await axios.post(
      `${FYI_URL}/external/document`,
      {
        metadata: {
          action: { value: "upsert" },
          data: {
            model: {
              name: "Arvin_Test Document",
              document_type: "Pdf",
            },
          },
        },
      },
      {
        headers: {
          "x-fyi-access-id": ACCESS_ID,
          "x-fyi-access-secret": SECRET_KEY,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    const versionId = createRes.data.data.version_id;
    console.log("Step 1 complete: versionId =", versionId);

    // Step 2: Authorize upload
    const authRes = await axios.post(
      `${FYI_URL}/external/document`,
      {
        metadata: { action: { value: "uploadForm" }, data: { id: versionId } },
      },
      {
        headers: {
          "x-fyi-access-id": ACCESS_ID,
          "x-fyi-access-secret": SECRET_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const { url, fields } = authRes.data.data;
    console.log("Step 2 complete: upload URL =", url);

    // Step 3: Upload file to S3
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    form.append("file", fs.createReadStream(filePath));

    const uploadRes = await axios.post(url, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
    });

    if (uploadRes.status === 204) {
      console.log("Step 3 complete: file uploaded successfully");
      res.json({ success: true, reference: versionId });
    } else {
      res.json({ success: false, error: "Upload failed" });
    }
  } catch (err) {
    if (err.response) {
      console.error("Error response:", err.response.status, err.response.data);
      res.json({ success: false, error: err.response.data });
    } else {
      console.error("Error during upload:", err.message);
      res.json({ success: false, error: err.message });
    }
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});