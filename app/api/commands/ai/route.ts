import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const language = body?.language === "javascript" ? "javascript" : "python";

    if (!prompt) {
      return NextResponse.json({ error: "A command description is required." }, { status: 400 });
    }

    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI command generation is not configured yet. Add AI_API_KEY to the Cloudflare Worker environment variables." },
        { status: 503 }
      );
    }

    const model = process.env.AI_MODEL || "gpt-5.6-luna";
    const apiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/responses";

    const system = `You are BotVault's Discord command generator. Generate safe, production-oriented slash-command starter code for discord.py (Python) or discord.js (JavaScript). Never include tokens, API keys, password collection, credential theft, destructive server-wide actions, or code that bypasses Discord permissions. Return ONLY valid JSON with exactly these fields: name, description, code. The name must be lowercase letters, numbers, hyphens or underscores and must be at most 32 characters. Keep the code focused on the requested command. Runtime: ${language}.`;

    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      return NextResponse.json(
        { error: `AI provider error: ${errorText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const data = await upstream.json();
    const outputText =
      data?.output_text ||
      data?.output?.flatMap((item: any) => item?.content || []).find((item: any) => item?.type === "output_text")?.text;

    if (!outputText) {
      return NextResponse.json({ error: "The AI provider returned no command." }, { status: 502 });
    }

    const parsed = JSON.parse(outputText);
    if (!parsed?.name || !parsed?.description || !parsed?.code) {
      return NextResponse.json({ error: "The AI returned an invalid command format." }, { status: 502 });
    }

    return NextResponse.json({
      name: String(parsed.name).toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 32),
      description: String(parsed.description).slice(0, 200),
      code: String(parsed.code),
    });
  } catch {
    return NextResponse.json({ error: "Unable to generate the command right now." }, { status: 500 });
  }
}
