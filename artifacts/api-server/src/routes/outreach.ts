import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { GenerateOutreachBody } from "@workspace/api-zod";

const router = Router();

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  de: "German",
  fr: "French",
  ru: "Russian",
  zh: "Chinese (Simplified)",
  pl: "Polish",
  es: "Spanish",
  it: "Italian",
  tr: "Turkish",
  nl: "Dutch",
  cs: "Czech",
  ro: "Romanian",
};

router.post("/search/outreach", async (req, res) => {
  const parseResult = GenerateOutreachBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { contactName, title, organisation, country, yards, language = "en" } = parseResult.data;

  const targetLanguage = LANGUAGE_LABELS[language] || "English";
  const addressee = contactName || `the ${title} at ${organisation}`;
  const yardText = yards && yards.length > 0 ? yards[0] : `${country}'s marshalling yard network`;

  const prompt = `Write a 3-sentence cold outreach message on behalf of a railway deceleration systems company called DECEL.

Recipient: ${addressee}
Role: ${title}
Organisation: ${organisation}
Country: ${country}
Target infrastructure: ${yardText}
Write in: ${targetLanguage}

Rules:
- Sentence 1: Reference the specific yard or ${country}'s hump yard network and acknowledge a real operational challenge they face (manual brake shoes, worn retarders, diesel shunting costs, or yard throughput bottlenecks).
- Sentence 2: State concisely what DECEL's automated wagon retarder systems deliver — reduced operating cost, improved safety, higher throughput — and mention proven installations at Hallsberg (Sweden) and Almaty (Kazakhstan) as references.
- Sentence 3: Propose a specific next step — a 30-minute call or sending a technical brief — framed as low-commitment.
- No greeting, no sign-off, no subject line. Peer-to-peer tone. No sales clichés.
- Output exactly 3 sentences in ${targetLanguage}, nothing else.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const message = response.choices[0]?.message?.content?.trim() ?? "Unable to generate message.";
    res.json({ message, language });
  } catch (err: any) {
    req.log.error({ err }, "Outreach generation failed");
    res.status(500).json({ error: "Failed to generate outreach message" });
  }
});

export default router;
