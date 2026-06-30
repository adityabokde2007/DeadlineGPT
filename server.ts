import "dotenv/config";
import fs from "fs";
import path from "path";

// Force load/override GEMINI_API_KEY from local .env if it exists
try {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/);
    if (match && match[1]) {
      process.env.GEMINI_API_KEY = match[1];
    }
  }
} catch (e) {
  console.error("Error overriding env key:", e);
}

import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

function parseGeminiResponse(text: string, fallbackType: "object" | "array" = "object"): any {
  let cleaned = text.trim();
  
  // Try direct parsing first
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Direct parsing failed, try cleaning
  }

  // Strip markdown-wrapped JSON if present
  if (cleaned.includes("```")) {
    cleaned = cleaned.replace(/```(?:json)?/g, "").trim();
  }

  // Attempt parsing again
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // If still failing, try to find the JSON object/array boundaries
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");

    if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (innerErr) {
        // Fall through
      }
    } else if (firstBracket !== -1 && lastBracket !== -1) {
      try {
        return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
      } catch (innerErr) {
        // Fall through
      }
    }

    console.warn("Failed to parse Gemini response as JSON, falling back. Raw response:", text);
    if (fallbackType === "array") {
      return [];
    } else {
      return {
        type: "chat",
        reply: text
      };
    }
  }
}

async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  initialDelayMs = 1500
): Promise<T> {
  let attempt = 1;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      console.error(`Gemini call failed on attempt ${attempt}:`, error);
      const errMsg = error?.message || String(error);
      const is503 = 
        errMsg.includes("503") || 
        errMsg.toLowerCase().includes("overloaded") || 
        errMsg.toLowerCase().includes("unavailable") ||
        errMsg.toLowerCase().includes("high demand") ||
        (error?.status === 503);

      if (is503 && attempt < maxAttempts) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        console.warn(`Gemini call failed (503/overloaded). Attempt ${attempt} of ${maxAttempts}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
      } else {
        throw error;
      }
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Initialize Gemini API
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Route: Extract text from image using Gemini
  app.post("/api/extract-text", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Image is required" });
      }

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: [
            { role: "user", parts: [
                { text: "Extract all text from this file and return only the text." },
                { inlineData: { data: image, mimeType: mimeType || "application/octet-stream" } }
              ]
            }
          ]
        })
      );

      const extractedText = response.text || "";
      res.json({ text: extractedText });
    } catch (error) {
      console.error("Error extracting text:", error);
      res.status(500).json({ error: "Failed to extract text" });
    }
  });

  // API Route: Transcribe audio
  app.post("/api/transcribe-audio", async (req, res) => {
    try {
      const { audio, mimeType } = req.body;
      if (!audio) {
        return res.status(400).json({ error: "Audio is required" });
      }

      let cleanMimeType = mimeType || "audio/webm";
      if (cleanMimeType.includes(';')) {
        cleanMimeType = cleanMimeType.split(';')[0];
      }

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: [
            { role: "user", parts: [
                { text: "Transcribe this audio strictly verbatim. Only return the transcribed text, nothing else." },
                { inlineData: { data: audio, mimeType: cleanMimeType } }
              ]
            }
          ]
        })
      );

      const text = response.text || "";
      res.json({ text: text.trim() });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  // API Route: Diagnose key active in runtime
  app.get("/api/diagnose-key", (req, res) => {
    const key = process.env.GEMINI_API_KEY || "";
    if (!key) {
      return res.json({ keyStatus: "missing", length: 0 });
    }
    const first10 = key.substring(0, 10);
    const last5 = key.substring(key.length - 5);
    res.json({
      keyStatus: "present",
      length: key.length,
      prefix: first10,
      suffix: last5,
      matchesExpected: key.length > 0
    });
  });

  // API Route: Evaluate Confirmation
  app.post("/api/evaluate-confirmation", async (req, res) => {
    try {
      const { message, conflictingItem } = req.body;
      if (!message || !conflictingItem) {
        return res.status(400).json({ error: "Missing parameters" });
      }

      const response = await callGeminiWithRetry(() => 
        ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: `The AI proposed scheduling a task at ${conflictingItem.startTime} on ${conflictingItem.date}, which is outside the user's focus hours.
User's reply: "${message}"

Determine the user's intent:
1. "confirmed": They agree to the proposed time (e.g., "yes", "that works", "go ahead").
2. "declined_with_new_time": They rejected the time and suggested a new one (e.g., "no, do 3pm", "tomorrow instead").
3. "declined": They declined without suggesting a specific new time (e.g., "no", "try another time").

Return JSON:
{
  "intent": "confirmed" | "declined_with_new_time" | "declined"
}`,
          config: {
            systemInstruction: "You are a confirmation evaluator. You MUST respond with ONLY valid JSON and no markdown.",
            responseMimeType: "application/json"
          }
        })
      );

      const responseText = response.text || "{}";
      res.json(parseGeminiResponse(responseText, "object"));
    } catch (error: any) {
      console.error("Evaluate confirmation error:", error);
      res.status(500).json({ error: "Failed to evaluate confirmation" });
    }
  });

  // API Route: Chat and task extraction
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const todayStr = new Date().toISOString().split('T')[0];
      
      let contentsText = message;
      if (history && history.length > 0) {
         contentsText = `Previous context:\n${history.map((m: any) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')}\n\nCurrent message: ${message}`;
      }

      let response;
      try {
        response = await callGeminiWithRetry(() => 
          ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: contentsText,
            config: {
              systemInstruction: `You are a task extraction and productivity assistant.
If the user's message contains one or more tasks with actions and deadlines, carefully detect and check if the user EXPLICITLY provided an estimated duration/time effort for each task (e.g. "1 hour", "30 mins", "for 2 hours"). 
If ANY task is missing an explicitly stated time estimate, DO NOT extract the tasks. Instead, respond naturally as a chat message asking the user for the estimated time effort for the task(s). Format it exactly as:
{
  "type": "chat",
  "reply": "How much time do you estimate this task will take?" (or similar natural question)
}

If ALL tasks have an explicitly stated time estimate OR if the user is providing the time estimate now, carefully detect and split them into an array of tasks matching this exact JSON shape:
{
  "type": "tasks",
  "tasks": [
    {
      "title": string,
      "deadline": "YYYY-MM-DD",
      "estimatedEffort": number (minutes),
      "priority": "low" | "medium" | "high" | "urgent" | "critical",
      "category": string,
      "subtasks": [{ "title": string, "estimatedMinutes": number }]
    }
  ]
}

If the user explicitly asks to cancel, remove, or delete a task they just added or mentioned, output:
{
  "type": "delete_task",
  "taskQuery": string (the approximate title or description of the task to delete),
  "reply": string (your natural conversational confirmation that you're removing the task)
}

Always assume dates without a year refer to the nearest future occurrence relative to today's date. Use the current year unless the date has already passed this year, in which case use next year. Today's date is ${todayStr}.
If the user does not explicitly state a priority, you MUST logically infer the priority based on how soon the deadline is relative to the current date. For example, if a task is due today or tomorrow, it should be "high" or "urgent". If it's due in a few days, "medium". If it's due further out, "low".

If the user's message is a general question, greeting, or casual conversation with NO tasks, respond naturally and helpfully as a friendly productivity assistant, in this exact JSON format:
{
  "type": "chat",
  "reply": string (your natural conversational response)
}

You must respond with ONLY valid JSON. Do not include markdown formatting or extra text outside the JSON structure.`,
              responseMimeType: "application/json"
            }
          })
        );
      } catch (geminiError: any) {
        console.error("Gemini Chat call permanently failed after retries:", geminiError);
        return res.json({
          type: "chat",
          reply: "Gemini is a bit busy right now, please try again in a moment."
        });
      }

      const responseText = response.text || "{}";
      res.json(parseGeminiResponse(responseText, "object"));
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      res.status(500).json({ error: error.message || "Failed to process chat with Gemini" });
    }
  });

  // API Route: Schedule Planner
  app.post("/api/schedule-plan", async (req, res) => {
    try {
      const { subtasks, estimatedEffort, availableHoursPerDay, deadline, currentDate, aiOptimizationMode, existingSchedule, originalMessage } = req.body;

      if (aiOptimizationMode === false) {
        // Deterministic, unoptimized fallback logic
        const schedule = [];
        let remainingMinutes = estimatedEffort || 60;
        let currentDay = new Date(currentDate);
        const maxMinutesPerDay = availableHoursPerDay * 60;

        while (remainingMinutes > 0) {
          const minutesToday = Math.min(remainingMinutes, maxMinutesPerDay);
          
          const dateStr = currentDay.toISOString().split('T')[0];
          // Default start time: 09:00
          const startHours = 9;
          const endHours = 9 + Math.floor(minutesToday / 60);
          const endMins = minutesToday % 60;
          
          schedule.push({
            date: dateStr,
            startTime: "09:00",
            endTime: `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`,
            aiNote: "Standard sequential block (Optimization Off)"
          });
          
          remainingMinutes -= minutesToday;
          currentDay.setDate(currentDay.getDate() + 1);
        }
        
        return res.json(schedule);
      }

      const systemInstruction = `You are a schedule planning assistant. Your task is to distribute the given task's subtasks into a schedule until the deadline.
Today's date is: ${currentDate}.
The deadline is: ${deadline}.
The total estimated effort is ${estimatedEffort} minutes.
The user has ${availableHoursPerDay} available hours per day for focus.

CRITICAL INSTRUCTION: You will be provided with the user's 'Existing Schedule'. You MUST NOT schedule any new tasks during the times specified in the existing schedule. Overlapping tasks are strictly forbidden. Choose available time slots that do not conflict with any existing scheduled items.
If the user's Original Message mentions explicit time constraints (e.g., "today from 2:00 PM to 3:00 PM"), you MUST respect those exact times for the scheduled item.

Distribute the subtasks across days between today and the deadline. Assign specific time slots (start time and end time in HH:MM format) for each scheduled item.
Return ONLY a valid JSON array of objects in this exact shape, with no markdown wrappers or extra text:
[
  {
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "aiNote": "A brief explanation or recommendation for this scheduled block"
  }
]`;

      const prompt = `Subtasks to schedule: ${JSON.stringify(subtasks)}. Total effort: ${estimatedEffort} minutes. Available hours per day: ${availableHoursPerDay}. Deadline: ${deadline}.
Original Message from user: "${originalMessage || 'N/A'}"

Existing Schedule (DO NOT OVERLAP WITH THESE):
${JSON.stringify(existingSchedule || [])}`;

      let response;
      try {
        response = await callGeminiWithRetry(() => 
          ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json"
            }
          })
        );
      } catch (geminiError: any) {
        console.error("Gemini Schedule call permanently failed after retries:", geminiError);
        return res.status(500).json({ error: "Gemini is a bit busy right now, please try again in a moment." });
      }

      const responseText = response.text || "[]";
      let schedule = parseGeminiResponse(responseText, "array");

      // Programmatic fallback to ensure no overlap occurs even if AI hallucinates
      const finalSchedule = [];
      const exSched = existingSchedule || [];
      for (let item of schedule) {
        if (!item.startTime || !item.endTime || !item.date) {
          finalSchedule.push(item);
          continue;
        }

        let sH = parseInt(item.startTime.split(':')[0]);
        let sM = parseInt(item.startTime.split(':')[1]);
        let eH = parseInt(item.endTime.split(':')[0]);
        let eM = parseInt(item.endTime.split(':')[1]);
        
        let hasOverlap = true;
        let safetyCounter = 0;
        
        while(hasOverlap && safetyCounter < 48) { // Max 48 loops (24 hours)
          hasOverlap = false;
          const myS = sH * 60 + sM;
          const myE = eH * 60 + eM;

          for (const ex of [...exSched, ...finalSchedule]) {
             if (ex.date === item.date && ex.startTime && ex.endTime) {
                const exS = parseInt(ex.startTime.split(':')[0]) * 60 + parseInt(ex.startTime.split(':')[1]);
                const exE = parseInt(ex.endTime.split(':')[0]) * 60 + parseInt(ex.endTime.split(':')[1]);
                
                // If the slots overlap (start is inside, end is inside, or completely envelops)
                if ((myS >= exS && myS < exE) || (myE > exS && myE <= exE) || (myS <= exS && myE >= exE)) {
                   hasOverlap = true;
                   
                   // Shift by 30 mins
                   sM += 30;
                   if (sM >= 60) { sM -= 60; sH += 1; }
                   eM += 30;
                   if (eM >= 60) { eM -= 60; eH += 1; }
                   
                   // Wrap to next day if pushed past midnight
                   if (sH >= 24) {
                     sH -= 24;
                     eH -= 24;
                     const d = new Date(item.date);
                     d.setDate(d.getDate() + 1);
                     item.date = d.toISOString().split('T')[0];
                   }
                   break;
                }
             }
          }
          safetyCounter++;
        }

        item.startTime = `${sH.toString().padStart(2, '0')}:${sM.toString().padStart(2, '0')}`;
        item.endTime = `${eH.toString().padStart(2, '0')}:${eM.toString().padStart(2, '0')}`;
        finalSchedule.push(item);
      }

      res.json(finalSchedule);
    } catch (error: any) {
      console.error("Gemini Schedule Error:", error);
      res.status(500).json({ error: error.message || "Failed to plan schedule with Gemini" });
    }
  });

  // API Route: Breakdown Task
  app.post("/api/breakdown-task", async (req, res) => {
    try {
      const { taskTitle, dueDate, priority, estimatedMinutes } = req.body;
      if (!taskTitle) {
        return res.status(400).json({ error: "Task title is required" });
      }

      const durationContext = estimatedMinutes 
        ? `The total estimated duration for this task is ${estimatedMinutes} minutes. CRITICAL REQUIREMENT: The sum of the 'estimatedMinutes' for all generated subtasks MUST EQUAL EXACTLY ${estimatedMinutes} minutes. Do NOT generate subtasks that add up to more than ${estimatedMinutes} minutes.` 
        : '';

      const prompt = `Break down the following task into 3-5 specific, actionable subtasks with estimated time durations for each. 
Task: '${taskTitle}', Due: '${dueDate || 'No due date'}', Priority: '${priority || 'normal'}'. 
${durationContext}
Return the response as a JSON array of objects, each with 'title' (string) and 'estimatedMinutes' (number) fields.`;

      let response;
      try {
        response = await callGeminiWithRetry(() => 
          ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
            config: {
              systemInstruction: "You are an AI task assistant. Break down the user's task into smaller actionable subtasks. Return ONLY a JSON array of objects with 'title' (string) and 'estimatedMinutes' (number). No markdown formatting outside of JSON.",
              responseMimeType: "application/json"
            }
          })
        );
      } catch (e: any) {
         console.warn("Fast model failed or fallback needed for task breakdown:", e);
         response = await callGeminiWithRetry(() => 
            ai.models.generateContent({
              model: "gemini-2.5-pro",
              contents: prompt,
              config: {
                systemInstruction: "You are an AI task assistant. Break down the user's task into smaller actionable subtasks. Return ONLY a JSON array of objects with 'title' (string) and 'estimatedMinutes' (number).",
                responseMimeType: "application/json"
              }
            })
         );
      }

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from AI");
      }
      const data = parseGeminiResponse(text, "array");
      res.json(data);
    } catch (error: any) {
      console.error("Gemini Task Breakdown Error:", error);
      res.status(500).json({ error: error.message || "Failed to breakdown task with Gemini" });
    }
  });

  // API Route: Smart Reschedule
  app.post("/api/suggest-reschedule", async (req, res) => {
    try {
      const { taskTitle, originalDate, priority, otherTasks } = req.body;
      if (!taskTitle) {
        return res.status(400).json({ error: "Task title is required" });
      }

      const prompt = `Suggest a new reschedule date/time for this overdue task.
Task: '${taskTitle}'
Original Due: '${originalDate}'
Priority: '${priority}'
Other tasks today/tomorrow: ${JSON.stringify(otherTasks || [])}

Find a reasonable next available time slot (e.g. tomorrow, or later today if early enough, avoiding overlaps). Return the response as a JSON object with a single 'suggestedDate' field containing an ISO 8601 string.`;

      let response;
      try {
        response = await callGeminiWithRetry(() => 
          ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
            config: {
              systemInstruction: "You are an AI task assistant. Return ONLY a JSON object with 'suggestedDate' (ISO 8601 string). No markdown formatting outside of JSON.",
              responseMimeType: "application/json"
            }
          })
        );
      } catch (e: any) {
         console.warn("Fast model failed or fallback needed for reschedule:", e);
         response = await callGeminiWithRetry(() => 
            ai.models.generateContent({
              model: "gemini-2.5-pro",
              contents: prompt,
              config: {
                systemInstruction: "You are an AI task assistant. Return ONLY a JSON object with 'suggestedDate' (ISO 8601 string). No markdown formatting outside of JSON.",
                responseMimeType: "application/json"
              }
            })
         );
      }

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from AI");
      }
      const data = parseGeminiResponse(text, "object");
      res.json(data);
    } catch (error: any) {
      console.error("Gemini Reschedule Error:", error);
      res.status(500).json({ error: error.message || "Failed to suggest reschedule with Gemini" });
    }
  });

  // API Route: Smart Nudges
  app.post("/api/nudge", async (req, res) => {
    try {
      const { tasks } = req.body;
      if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: "Tasks array is required" });
      }

      const prompt = `Here are the user's current pending tasks and their deadlines: ${JSON.stringify(tasks)}.
Generate context-aware, helpful, highly specific nudges for the user.
Return ONLY valid JSON in this exact shape:
{
  "lightbulb": {
    "title": "A short observation or tip",
    "subtitle": "A short actionable suggestion"
  },
  "alert": {
    "title": "A short warning about deadlines or high priority tasks",
    "subtitle": "A short mitigation strategy"
  }
}`;

      let response;
      try {
        response = await callGeminiWithRetry(() => 
          ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
            config: {
              systemInstruction: "You are a highly intelligent task management AI. Based on the user's pending tasks, analyze upcoming deadlines, priorities, or categories to generate two customized, encouraging, context-aware smart nudges. One should be a positive tip/observation, and the other should be a helpful heads-up/warning. Keep each title and subtitle under 12 words, extremely concise.",
              responseMimeType: "application/json"
            }
          })
        );
      } catch (geminiError: any) {
        console.warn("Gemini Nudge call permanently failed after retries:", geminiError);
        return res.json({ lightbulb: null, alert: null });
      }

      if (response) {
        const responseText = response.text || "{}";
        res.json(parseGeminiResponse(responseText, "object"));
      } else {
        res.json({ lightbulb: null, alert: null });
      }
    } catch (error: any) {
      console.log("Silently caught Gemini nudge error to prevent dashboard/chat crashes:", error?.message || error);
      res.json({ lightbulb: null, alert: null });
    }
  });

  // API Route: Refresh Google OAuth Token
  app.post("/api/refresh-google-token", async (req, res) => {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        return res.status(400).json({ error: "refresh_token is required" });
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: "Google OAuth credentials not configured on server" });
      }

      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error refreshing Google token:", error);
      res.status(500).json({ error: "Failed to refresh token" });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
