import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const PORT = 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Real-time Chat Logic
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' })); // Higher limit for base64 images

  const httpServer = createServer(app);
  // ... socket.io logic remains same ...
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    // ... logic ...
    socket.on("join-room", (roomId) => {
      socket.join(roomId);
    });
    socket.on("send-message", (data) => {
      io.to(data.roomId).emit("new-message", data);
    });
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Assistant Chat (Migrated from client)
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { prompt, history, image } = req.body;
      
      const contents: any[] = history.map((item: any) => ({
        role: item.role,
        parts: [{ text: item.parts[0].text }]
      }));

      const parts: any[] = [{ text: prompt || "วิเคราะห์สิ่งนี้" }];
      
      if (image) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: image
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [...contents, { role: "user", parts }],
        config: {
          systemInstruction: "คุณคือผู้ช่วยเกษตรกรไทยที่มีความเชี่ยวชาญด้านสมุนไพรไทยและการปลูกพืช ให้คำแนะนำเป็นภาษาไทยที่สุภาพ เข้าใจง่าย เหมาะกับผู้สูงอายุ ตอบคำถามเรื่องสูตรสมุนไพร วิธีดูแลพืช และวิเคราะห์โรคพืชจากรูปถ่าย ทุกครั้งที่ให้ข้อมูลเกี่ยวกับการรักษาโรคด้วยสมุนไพร ต้องมีข้อความ 'คำเตือน: โปรดปรึกษาแพทย์หรือผู้เชี่ยวชาญก่อนใช้งาน' กำกับเสมอ ห้ามอ้างว่าเป็นแพทย์จริง",
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Intelligent Problem Solver & Learner
  app.post("/api/ai/solve", async (req, res) => {
    try {
      const { problemDescription, diagnostics, recentSolutions } = req.body;

      const systemPrompt = `คุณคือวิศวกรซอฟต์แวร์ AI อัจฉริยะที่ดูแลแอปพลิเคชัน Kaset Thai (เกษตรกรไทย)
หน้าที่ของคุณคือ:
1. วิเคราะห์ปัญหา (Bugs, Performance, UI Issues) จากคำอธิบายและข้อมูล Diagnostics (Metrics, Errors, Env)
2. เสนอวิธีการแก้ไขปัญหาอย่างมีประสิทธิภาพ
3. เรียนรู้จากวิธีแก้ปัญหาในอดีต (Knowledge Base) เพื่อแก้ปัญหาที่คล้ายกันได้เร็วขึ้น

ข้อมูลแอป: เป็นแอป React + Vite + Tailwind + Express + Firebase
ปัญหาปัจจุบัน: ${problemDescription}
ข้อมูลทางเทคนิค (Diagnostics): ${JSON.stringify(diagnostics, null, 2)}
วิธีแก้ที่เคยทำ (Knowledge Base): ${JSON.stringify(recentSolutions, null, 2)}

โปรดตอบเป็นภาษาไทยในรูปแบบ JSON:
{
  "analysis": "วิเคราะห์สาเหตุ",
  "solution": "ขั้นตอนการแก้ไข",
  "technicalNote": "โน้ตทางเทคนิคสำหรับนักพัฒนา",
  "confidence": 0-1
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });

      res.json(JSON.parse(response.text));
    } catch (error: any) {
      console.error("AI Solver Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
