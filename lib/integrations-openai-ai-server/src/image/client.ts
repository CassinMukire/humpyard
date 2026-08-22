// =============================================================================
// OpenAI image client — lazy, env-tolerant
// Same pattern as the main client: throws on first use, not at import.
// Used by image generation tools (not used in v1 by the api-server).
// =============================================================================

import fs from "node:fs";
import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";

function getOpenAIConfig(): { apiKey: string; baseURL: string } {
  const apiKey =
    process.env["OPENAI_API_KEY"] ??
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY must be set to use OpenAI image routes.",
    );
  }
  const baseURL =
    process.env["OPENAI_BASE_URL"] ??
    process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] ??
    "https://api.openai.com/v1";
  return { apiKey, baseURL };
}

let _client: OpenAI | null = null;

export function getImageClient(): OpenAI {
  if (_client) return _client;
  const { apiKey, baseURL } = getOpenAIConfig();
  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getImageClient(), prop, receiver);
  },
});

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  const response = await getImageClient().images.generate({
    model: "gpt-image-1",
    prompt,
    size,
  });
  const base64 = response.data?.[0]?.b64_json ?? "";
  return Buffer.from(base64, "base64");
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string
): Promise<Buffer> {
  const images = await Promise.all(
    imageFiles.map((file) =>
      toFile(fs.createReadStream(file), file, {
        type: "image/png",
      })
    )
  );

  const response = await getImageClient().images.edit({
    model: "gpt-image-1",
    image: images,
    prompt,
  });

  const imageBase64 = response.data?.[0]?.b64_json ?? "";
  const imageBytes = Buffer.from(imageBase64, "base64");

  if (outputPath) {
    fs.writeFileSync(outputPath, imageBytes);
  }

  return imageBytes;
}
