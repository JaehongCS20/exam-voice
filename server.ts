import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON request body parser
  app.use(express.json());

  // Initialize Gemini SDK lazily
  let aiClient: GoogleGenAI | null = null;
  function getAi(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required for pronunciation optimization.");
      }
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return aiClient;
  }

  // API Endpoint: Optimize text for speech synthesis (TTS-friendly conversion)
  app.post("/api/tts/optimize", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "텍스트가 올바르지 않습니다." });
      }

      const ai = getAi();
      const prompt = `다음 구조공학 또는 기술사 시험 텍스트를 전문 성우가 낭독에 최적화하여 낭독하기 아주 편하고 귀로 듣기에 또렷하고 알아듣기 쉬운 한글 낭독 대본으로 가공해주십시오.

규칙:
1. 영문 약자는 반드시 소리나는 한글로 풀어 쓰십시오. (예: FCM -> 에프 씨 엠, BIM -> 빔, PSC -> 피 에스 씨, RC -> 알 씨 또는 아르 씨, VE -> 브이 이, KDS -> 케이 디 에스, CFT -> 씨 에프 티, HDRB -> 에이치 디 알 비 등)
2. 어려운 기호나 공식 내 단위는 한국어로 풀어쓰십시오. (예: kN/m³ -> 킬로뉴턴 세제곱미터, kN/m² -> 킬로뉴턴 제곱미터, kPa -> 킬로파스칼, MPa -> 메가파스칼, GPa -> 기가파스칼, Φ -> 피, μ -> 뮤, kg -> 킬로그램, m -> 미터, cm -> 센티미터, mm -> 밀리미터, ° -> 도)
3. 수식이나 약기호(예: pi^2 * EI / L^2)는 읽기 편하게 한국어 문장으로 풀어 적어 주십시오. (예: 'L의 제곱 분의 파이 제곱 곱하기 이 아이' 와 같이 수식이 한글로 또렷이 발음되도록)
4. 문맥의 호흡에 맞춰 적절한 쉼표(,), 마침표(.)를 정교하게 배치하고, 줄바꿈을 문장 단위로 깔끔하게 해주십시오.
5. <break time=\"350ms\"/> 나 <break time=\"700ms\"/> 같은 SSML 쉬어가기 요소를 포함한 SSML 형식으로 전체를 감싸서 변환해 주면 좋습니다. 또는 <p> 태그와 <break> 가 포함된 잘 짜여진 <speak> 구조로 만들어 주십시오.

대상 텍스트:
${text}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "당신은 한국어로 된 복잡한 공학 텍스트를 기호, 알파벳을 한글 발음으로 풀어서 또렷하고 정교한 오디오 낭독용 SSML 또는 텍스트 대본으로 제작하는 전문 국어 가공 전문가입니다.",
        },
      });

      const optimizedText = response.text || "";
      res.json({ result: optimizedText });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "변환 중 요류가 발생했습니다." });
    }
  });

  // Serve static files / Vite middleware
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
