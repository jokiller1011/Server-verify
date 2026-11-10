// Import the REAL Cap core library directly from a CDN
// This bypasses the need for 'npm install'
import { generateChallenge, validateChallenge } from 'https://esm.sh/capjs-core';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- Cap Challenge Generation Route ---
    // The widget calls this to get a challenge to solve
    if (url.pathname === '/api/cap/challenge' && request.method === 'POST') {
        try {
            // Use the secret you will set in Cloudflare
            const challenge = await generateChallenge(env.CAP_SECRET);
            return new Response(JSON.stringify(challenge), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
    }

    // --- Cap Token Redeem Route ---
    // The widget calls this to submit its solution
    if (url.pathname === '/api/cap/redeem' && request.method === 'POST') {
        try {
            const { token, solutions } = await request.json();
            // Validate the solution using your secret
            const result = await validateChallenge(env.CAP_SECRET, {
                token,
                solutions
            });
            
            if (result.success) {
                // Return the final token that the frontend will send to /api/verify
                return new Response(JSON.stringify({ success: true, token: result.token }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                return new Response(JSON.stringify({ success: false, error: result.error || 'Validation failed' }), { status: 400 });
            }
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
    }

    // --- Final Verification and Email Route ---
    if (url.pathname === "/api/verify" && request.method === "POST") {
      try {
        const { username, capToken } = await request.json();

        if (!capToken) {
            throw new Error("Missing Cap token. Please complete the CAPTCHA.");
        }

        // Send Email via Google Apps Script
        const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbwXD31EDB3-JiRGnKfC2U_rz3owT8cbNlQWh6pFUqBbe98LneCGWpG_LsuOMr2RUIps/exec';
        
        const emailPayload = JSON.stringify({
          to: 'josiah.wilke@huttoisd.org',
          subject: `New Server Verification: ${username}`,
          htmlBody: `
            <h3>New Verification Request</h3>
            <p>User <strong>${username}</strong> has successfully passed the Cap check on serververify.de5.net/vesper.</p>
            <p>They are awaiting your review in the server.</p>
          `
        });

        const initialResponse = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: emailPayload,
          redirect: 'manual' 
        });

        // Follow the redirect manually to get the final JSON response from Google
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
