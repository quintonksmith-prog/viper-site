// netlify/functions/analyze.js
// Viper Software — Workflow Analyzer API Proxy
// Calls the Anthropic API server-side so the key is never exposed in the browser.
//
// SETUP:
//   1. In your Netlify dashboard → Site Settings → Environment Variables, add:
//        ANTHROPIC_API_KEY = sk-ant-...your key...
//   2. Deploy. The function will be live at:
//        https://viper-software.com/.netlify/functions/analyze

exports.handler = async function (event) {
  // ── CORS preflight ──────────────────────────────────────────
  const corsHeaders = {
    "Access-Control-Allow-Origin":  "https://viper-software.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Method not allowed" }),
    };
  }

  // ── Parse request ───────────────────────────────────────────
  let workflow, systemPrompt;
  try {
    const body = JSON.parse(event.body || "{}");
    workflow     = (body.workflow     || "").trim();
    systemPrompt = (body.systemPrompt || "").trim();
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Invalid JSON body" }),
    };
  }

  if (!workflow) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: "No workflow text provided" }),
    };
  }

  // ── Call Anthropic ──────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "API key not configured" }),
    };
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":         "application/json",
        "x-api-key":            apiKey,
        "anthropic-version":    "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 600,
        system:     systemPrompt || "You are a helpful automation consultant.",
        messages: [
          { role: "user", content: workflow }
        ],
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      const msg = data?.error?.message || "Anthropic API error";
      return {
        statusCode: anthropicRes.status,
        headers: corsHeaders,
        body: JSON.stringify({ message: msg }),
      };
    }

    const content = data?.content?.[0]?.text || "";
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    };

  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Failed to reach Anthropic API: " + err.message }),
    };
  }
};
