export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/verify" && request.method === "POST") {
      try {
        const { username, turnstileToken } = await request.json();

        // Check if the environment variable is actually loading
        if (!env.TURNSTILE_SECRET_KEY) {
            throw new Error("Environment variable TURNSTILE_SECRET_KEY is missing.");
        }

        // 1. Validate Turnstile Token (Using URLSearchParams instead of FormData)
        const turnstileData = new URLSearchParams();
        turnstileData.append('secret', env.TURNSTILE_SECRET_KEY);
        turnstileData.append('response', turnstileToken);

        const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: turnstileData // URLSearchParams automatically sets the correct Content-Type
        });
        
        const turnstileResult = await turnstileResponse.json();

        if (!turnstileResult.success) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: `Turnstile Error: ${JSON.stringify(turnstileResult['error-codes'] || 'Unknown')}` 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 2. Send Email via Google Apps Script
        const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbwXD31EDB3-JiRGnKfC2U_rz3owT8cbNlQWh6pFUqBbe98LneCGWpG_LsuOMr2RUIps/exec';
        
        const emailPayload = new URLSearchParams({
          to: 'josiah.wilke@huttoisd.org',
          subject: `New Server Verification: ${username}`,
          htmlBody: `
            <h3>New Verification Request</h3>
            <p>User <strong>${username}</strong> has successfully passed the Turnstile check.</p>
          `
        });

        const initialResponse = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: emailPayload,
          redirect: 'manual' 
        });

        if (initialResponse.status === 302) {
            const redirectUrl = initialResponse.headers.get('Location');
            const finalResponse = await fetch(redirectUrl, {
                method: 'GET',
                redirect: 'manual'
            });

            const finalResponseText = await finalResponse.text();
            
            try {
                const emailResult = JSON.parse(finalResponseText);
                if (!emailResult.success) {
                    throw new Error(emailResult.error || "Apps Script returned success: false");
                }
            } catch (e) {
                 throw new Error("Invalid response from Google. Make sure Apps Script is deployed to 'Anyone'. Response: " + finalResponseText.substring(0, 50));
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
        console.error("Caught error:", error.message);
        return new Response(JSON.stringify({ success: false, message: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
