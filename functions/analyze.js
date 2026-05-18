// functions/analyze.js
// Viper Software — Workflow Analyzer API Proxy (Cloudflare Pages Function)
// Calls the Anthropic API server-side so the key is never exposed in the browser.
//
// SETUP:
//   In your Cloudflare Pages dashboard → Settings → Environment Variables, add:
//     ANTHROPIC_API_KEY = sk-ant-...your key...

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "https://viper-software.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const apiKey = context.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ message: "API key not configured" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  let workflow, systemPrompt;
  try {
    const body = await context.request.json();
    workflow     = (body.workflow     || "").trim();
    systemPrompt = (body.systemPrompt || "").trim();
  } catch {
    return new Response(
      JSON.stringify({ message: "Invalid JSON body" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  if (!workflow) {
    return new Response(
      JSON.stringify({ message: "No workflow text provided" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 600,
        system:     systemPrompt || "You are a helpful automation consultant.",
        messages: [{ role: "user", content: workflow }],
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      const msg = data?.error?.message || "Anthropic API error";
      return new Response(
        JSON.stringify({ message: msg }),
        { status: anthropicRes.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const content = data?.content?.[0]?.text || "";
    return new Response(
      JSON.stringify({ content }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ message: "Failed to reach Anthropic API: " + err.message }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}
