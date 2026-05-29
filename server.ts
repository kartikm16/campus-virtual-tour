import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize the Google GenAI SDK using process.env.GEMINI_API_KEY
// Note: We use lazy initialization/checks as per platform warnings to prevent crashes
let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("GoogleGenAI initialized successfully on server.");
  } else {
    console.warn("GEMINI_API_KEY is not defined. AI narration will fall back to browser-side SpeechSynthesis.");
  }
} catch (err) {
  console.error("Failed to initialize Google GenAI SDK:", err);
}

const NARRATION_TEXTS: Record<string, string> = {
  "pillai-central-library": "Welcome to the college library. This space is designed to provide students with a peaceful and resourceful environment for learning and research. The library contains academic books, journals, digital resources, and study materials from multiple departments. Students can use this area for self-study, project work, and exam preparation. The calm atmosphere helps students improve focus, creativity, and knowledge.",
  "robotics-lab": "Welcome to the Robotics Laboratory. This lab is dedicated to innovation, automation, and hands-on technical learning. Students work on robotics projects, embedded systems, sensors, and AI-based applications here. The lab encourages creativity, teamwork, and real-world problem solving. It helps students gain practical experience with modern technology and engineering concepts.",
  "state-of-the-art-computer-lab": "Welcome to the Computer Laboratory. This lab is equipped with modern computer systems and software required for programming, development, and technical learning. Students perform coding practice, software development, simulations, and project implementation here. The lab supports learning in areas such as artificial intelligence, web development, cybersecurity, and data science. It provides students with practical exposure to modern computing technologies.",
  "classroom": "Welcome to the classroom area. This environment is designed to support interactive learning and academic growth. Students attend lectures, presentations, and group discussions here. Smart teaching methods and digital learning tools help improve understanding and communication. The classroom creates a collaborative atmosphere where students can develop technical and professional skills.",
  "canteen": "Welcome to the college canteen. This is one of the most social and relaxing places on campus where students spend time with friends during breaks. The canteen offers a variety of food and beverages in a comfortable environment. It helps students refresh, interact, and build friendships. The lively atmosphere makes it an important part of campus life.",
  "mes-auditorium-and-seminar-hall": "Welcome to the college auditorium. This venue is used for seminars, technical events, cultural programs, and important college functions. Students participate in presentations, performances, and competitions here. The auditorium encourages confidence, creativity, and public speaking skills. It plays an important role in student engagement and extracurricular development.",
};

// In-memory cache to save generated base64 speech audio streams & avoid redundant API billing/quota limits
const narrationCache: Record<string, string> = {};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", apiReady: !!ai });
  });

  // Narration AI synthesis endpoint
  app.post("/api/narration", async (req, res) => {
    const { sectionId } = req.body;
    if (!sectionId) {
      return res.status(400).json({ error: "Missing sectionId parameter" });
    }

    const textToSpeak = NARRATION_TEXTS[sectionId];
    if (!textToSpeak) {
      return res.status(404).json({ error: "Section narration text not found" });
    }

    // Return from cache if already generated
    if (narrationCache[sectionId]) {
      console.log(`[Cache Hit] Serving audio narration for section: ${sectionId}`);
      return res.json({ audio: narrationCache[sectionId], text: textToSpeak });
    }

    // Check if AI client is ready
    if (!ai) {
      console.warn(`[Fallback] Gemini API key missing. Requesting classroom fallback.`);
      return res.json({ fallback: true, text: textToSpeak });
    }

    try {
      console.log(`[Synthesizing] Requesting Gemini TTS for section: ${sectionId}`);
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Say clearly with a realistic, warm and professional professional voice: ${textToSpeak}` }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" }, // beautiful premium speech voice
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("No audio payload returned from Gemini TTS API");
      }

      // Cache the audio file for subsequent instant calls
      narrationCache[sectionId] = base64Audio;
      console.log(`[Cached] Successfully cached narration for: ${sectionId}`);

      return res.json({ audio: base64Audio, text: textToSpeak });
    } catch (error: any) {
      console.error(`Gemini TTS generation failed for ${sectionId}:`, error?.message || error);
      // Return fallback signal so the client can speak using browser Web Speech API
      return res.json({ fallback: true, text: textToSpeak, error: error?.message || "Generation error" });
    }
  });

  // Vite integration middleware config
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
    console.log(`Server fully operational on http://localhost:${PORT}`);
  });
}

startServer();
