/**
 * Helper to safely load and interact with Google Gemini API on the backend.
 * Never prints, logs, or exposes the API key.
 */
export function getGeminiApiKey(): { apiKey: string } | { error: string; status: number } {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'PASTE_YOUR_KEY_HERE') {
    return {
      error: 'Gemini API key is missing or still set to the placeholder. Please configure a valid GEMINI_API_KEY in server/.env',
      status: 500,
    };
  }

  return { apiKey };
}

const FALLBACK_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
];

/**
 * Call Gemini API with automatic model fallback.
 */
export async function generateGeminiContent(prompt: string, systemInstruction?: string): Promise<string> {
  const keyResult = getGeminiApiKey();
  if ('error' in keyResult) {
    throw new Error(keyResult.error);
  }

  let lastError: Error | null = null;

  for (const model of FALLBACK_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyResult.apiKey}`;
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
      };

      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // If temporary 503 or 429, continue to next model
        if (res.status === 503 || res.status === 429) {
          lastError = new Error(data?.error?.message || `Model ${model} unavailable (${res.status})`);
          continue;
        }
        throw new Error(data?.error?.message || `Gemini API returned status ${res.status}`);
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return text;
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to generate response from Gemini API');
}
