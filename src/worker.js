export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/verify" && request.method === "POST") {
      try {
        const { username, turnstileToken } = await request.json();
        console.log("Received token from frontend:", turnstileToken);

        // 1. Validate Turnstile Token
        const turnstileFormData = new FormData();
        turnstileFormData.append('secret', env.TURNSTILE_SECRET_KEY);
        turnstileFormData.append('response', turnstileToken);

        const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: turnstileFormData
        });
        const turnstileData = await turnstileResponse.json();
        console.log("Turnstile API Response:", JSON.stringify(turnstileData));

        if (!turnstileData.success) {
          return new Response(JSON.stringify({ success: false, message: 'Turnstile validation failed' }), {
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
            <p>User <strong>${username}</strong> has successfully passed the Turnstile check on serververify.de5.net/vesper.</p>
            <p>They are awaiting your review in the server.</p>
          `
        });

        // --- FIX: First, make the initial POST request with redirect: 'manual' ---
        const initialResponse = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded' 
          },
          body: emailPayload,
          redirect: 'manual' // This is the key change
        });

        // Check if we got the expected 302 redirect
        if (initialResponse.status === 302) {
            const redirectUrl = initialResponse.headers.get('Location');
            console.log("Following redirect to:", redirectUrl);

            // Make a second, GET request to the redirect URL
            const finalResponse = await fetch(redirectUrl, {
                method: 'GET',
                redirect: 'manual' // Also set to manual here to be safe
            });

            const finalResponseText = await finalResponse.text();
            console.log("Final Apps Script Response:", finalResponseText);

            // Try to parse the final response as JSON
            try {
                const emailResult = JSON.parse(finalResponseText);
                if (!emailResult.success) {
                    throw new Error(emailResult.error || "Failed to send email via Apps Script");
                }
            } catch (e) {
                 // If parsing fails, the redirect might have returned HTML (e.g., a login page)
                 throw new Error("Apps Script redirect did not return valid JSON. Response: " + finalResponseText);
            }

        } else {
            // If the initial response is not a 302, something else is wrong.
            const errorText = await initialResponse.text();
            throw new Error(`Expected a 302 redirect but got ${initialResponse.status}. Response: ${errorText}`);
        }
        // --- End of fix ---

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error("Caught error:", error.message);
        return new Response(JSON.stringify({ success: false, message: 'Internal server error: ' + error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
