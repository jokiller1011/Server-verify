import { generateChallenge, validateChallenge } from 'capjs-core';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- Cap Challenge Generation ---
    if (url.pathname === '/cap/challenge' && request.method === 'POST') {
        try {
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

    // --- Cap Token Redeem (FIXED) ---
    if (url.pathname === '/cap/redeem' && request.method === 'POST') {
        try {
            const body = await request.json();
            const result = await validateChallenge(env.CAP_SECRET, body, {
                scope: "signup"
            });
            
            if (!result.success) {
                console.error("Validation failed:", result.reason);
                return new Response(JSON.stringify({ success: false, reason: result.reason }), { status: 400 });
            }

            // The widget requires the `expires` timestamp to validate the token.
            return new Response(JSON.stringify({ 
                success: true, 
                token: result.token,
                expires: result.expires 
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error("Redeem failed:", error.message);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
    }

    // --- Final Verification and Email ---
    if (url.pathname === "/api/verify" && request.method === "POST") {
      try {
        const { username, capToken } = await request.json();

        if (!capToken) {
            throw new Error("Missing Cap token.");
        }

        const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbwXD31EDB3-JiRGnKfC2U_rz3owT8cbNlQWh6pFUqBbe98LneCGWpG_LsuOMr2RUIps/exec';
        
        const emailPayload = JSON.stringify({
          to: 'josiah.wilke@huttoisd.org',
          subject: `New Server Verification: ${username}`,
          htmlBody: `<h3>New Verification</h3><p>User <strong>${username}</strong> has passed the Cap check.</p>`
        });

        const initialResponse = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: emailPayload,
          redirect: 'manual' 
        });

        if (initialResponse.status === 302) {
            const redirectUrl = initialResponse.headers.get('Location');
            const finalResponse = await fetch(redirectUrl, { method: 'GET' });
            const finalResponseText = await finalResponse.text();
            
            try {
                const emailResult = JSON.parse(finalResponseText);
                if (!emailResult.success) {
                    throw new Error(emailResult.error || "Apps Script returned an error");
                }
            } catch (e) {
                 throw new Error("Invalid response from Google. Response: " + finalResponseText.substring(0, 50));
            }
        } else {
            const errorText = await initialResponse.text();
            throw new Error(`Expected 302 redirect, got ${initialResponse.status}. Response: ${errorText.substring(0, 50)}`);
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ success: false, message: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
