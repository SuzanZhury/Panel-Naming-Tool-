import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase the payload size limits to allow larger drawing images (elevation drawings)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API endpoint for panel detection
  app.post("/api/detect-panels", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(400).json({
          error: "Gemini API key is not configured. Please add your GEMINI_API_KEY in the Secrets panel in Settings.",
        });
      }

      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Missing image data" });
      }

      // Lazy initialize GoogleGenAI client
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Prepare image part for Gemini multimodal request
      // We strip any data:image/png;base64, prefixes if present
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

      const imagePart = {
        inlineData: {
          mimeType: mimeType || "image/png",
          data: base64Data,
        },
      };

      const systemPrompt = `You are an expert architectural drafting assistant.
Your task is to analyze the elevation drawing of panels (rectangular 2D shapes).
Look for all rectangular panels in the drawing.
For each panel, attempt to detect its physical dimensions (width and height) written inside, near, or pointing to the panel (commonly e.g. "1200 x 600", "900", "600", "W: 1000, H: 450", or labeled dimensions).
Detect the panel's bounding box relative to the image coordinate system.
For coordinates (x, y, width, height), express them as percentages (0 to 100) of the total image width and height.
- x: percentage from left (0 to 100) of the center or top-left of the panel (let's use top-left of the panel).
- y: percentage from top (0 to 100) of the top-left of the panel.
- width: horizontal width of the panel as a percentage of the total image width (0 to 100).
- height: vertical height of the panel as a percentage of the total image height (0 to 100).
- realWidth: the physical dimension width of the panel in real-world units (e.g. 1200, 1500, 90) as extracted from the drawing text labels. If not visible or ambiguous, make a reasonable estimation or default to 0.
- realHeight: the physical dimension height of the panel in real-world units (e.g. 600, 800, 45) as extracted from the drawing text labels. If not visible or ambiguous, make a reasonable estimation or default to 0.
- unit: the physical unit (typically "mm", "in", "cm", or leave empty if not specified).

Analyze the visual structure carefully. Groupings are repeated, so identify all major panel boundaries.
Return the output strictly matching the requested JSON schema.`;

      // We can implement a retry mechanism with exponential backoff for transient API errors (e.g. 503, 429)
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      let lastError: any = null;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [
              imagePart,
              {
                text: "Detect all the rectangular panels on this elevation, find their width and height from the labels written on or near them, and return their relative bounding boxes (0-100%).",
              },
            ],
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.1, // low temperature for precise JSON parsing
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  panels: {
                    type: Type.ARRAY,
                    description: "List of all detected rectangular panels",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        x: {
                          type: Type.NUMBER,
                          description: "Top-left x coordinate as percentage of image width (0 to 100)",
                        },
                        y: {
                          type: Type.NUMBER,
                          description: "Top-left y coordinate as percentage of image height (0 to 100)",
                        },
                        width: {
                          type: Type.NUMBER,
                          description: "Width as percentage of image width (0 to 100)",
                        },
                        height: {
                          type: Type.NUMBER,
                          description: "Height as percentage of image height (0 to 100)",
                        },
                        realWidth: {
                          type: Type.NUMBER,
                          description: "Physical real-world width (numeric value extracted from labels, e.g. 1200)",
                        },
                        realHeight: {
                          type: Type.NUMBER,
                          description: "Physical real-world height (numeric value extracted from labels, e.g. 600)",
                        },
                        unit: {
                          type: Type.STRING,
                          description: "Physical unit, e.g., mm, in, cm, etc.",
                        },
                      },
                      required: ["x", "y", "width", "height", "realWidth", "realHeight"],
                    },
                  },
                },
                required: ["panels"],
              },
            },
          });
          // If successful, break out of the retry loop
          break;
        } catch (err: any) {
          lastError = err;
          console.warn(`Attempt ${attempts} failed: ${err.message || err}.`);
          if (attempts < maxAttempts) {
            // Exponential backoff: 1s, 2s...
            const delay = attempts * 1500;
            console.log(`Waiting ${delay}ms before retrying...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (!response) {
        throw lastError || new Error("Failed to generate content after several attempts.");
      }

      const responseText = response.text || "{}";
      const data = JSON.parse(responseText);

      return res.json(data);
    } catch (error: any) {
      console.error("Gemini detection error:", error);
      let errorMsg = error.message || String(error);
      
      // Attempt to parse structured error string if it is JSON from the Google API client
      try {
        if (typeof errorMsg === "string" && errorMsg.trim().startsWith("{")) {
          const parsed = JSON.parse(errorMsg);
          if (parsed.error && parsed.error.message) {
            errorMsg = parsed.error.message;
          }
        }
      } catch (e) {
        // Ignore parsing errors and keep original errorMsg
      }

      // Add a helpful hint for model unavailable / 503 issues
      if (errorMsg.includes("high demand") || errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE")) {
        errorMsg = `The Gemini model is currently experiencing high demand. Spikes are temporary. Please try again in a few moments, or click the "Simulate Demo" button above to test the labeling and grouping logic instantly without API calls.`;
      } else if (
        errorMsg.includes("quota") ||
        errorMsg.includes("429") ||
        errorMsg.includes("RESOURCE_EXHAUSTED") ||
        errorMsg.includes("limit")
      ) {
        errorMsg = `The Gemini API free-tier quota has been exceeded. Please try again in a few minutes, or click the "Simulate Demo" button to experience the automatic layout detection, sizing calibration, and serial indexing immediately without an API key.`;
      }

      return res.status(500).json({
        error: `AI Auto-Detect failed: ${errorMsg}`,
        details: errorMsg,
      });
    }
  });

  // Serve Vite or static files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
