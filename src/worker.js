import { generateChallenge, validateChallenge } from 'capjs-core';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- Cap Challenge Generation ---
    if (url.pathname === '/cap/challenge' && request.method === 'POST') {
        try {
            // Use only the essential options. The widget will handle the rest.
            const challenge = await generateChallenge(env.CAP_SECRET, {
                scope: "signup"
            });
            return new Response(JSON.stringify(challenge), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error("Challenge generation failed:", error.message);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
    }

    // --- Cap Token Redeem ---
    if (url.pathname === '/cap/redeem' && request.method === 'POST') {
        try {
            const body = await request.json();
            // The body from the widget contains { token, solutions, instr }
            const result = await validateChallenge(env.CAP_SECRET, body, {
                scope: "signup"
            });
            
            if (!result.success) {
                console.error("Validation failed:", result.reason);
                return new Response(JSON.stringify({ success: false, reason: result.reason }), { status: 400 });
            }

            return new Response(JSON.stringify({ success: true, token: result.token }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error("Redeem failed:", error.message);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
    }

    // --- Final Verification and Email ---
    if (url.pathname === "/api/verify" && request.method === "POST") {
      // ... (Your existing email-sending logic remains unchanged) ...
      // Make sure it expects `capToken` in the body.
    }

    return env.ASSETS.fetch(request);
  }
};
