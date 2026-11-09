export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/verify" && request.method === "POST") {
      try {
        const { username, turnstileToken } = await request.json();

        // 1. Validate Turnstile Token
        const turnstileFormData = new FormData();
        turnstileFormData.append('secret', env.TURNSTILE_SECRET_KEY);
        turnstileFormData.append('response', turnstileToken);

        const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: turnstileFormData
        });
        const turnstileData = await turnstileResponse.json();

        if (!turnstileData.success) {
          // Pass the exact Turnstile error codes
          return new Response(JSON.stringify({ 
            success: false, 
            message: `Turnstile Error: ${JSON.stringify(turnstileData['error-codes'] || 'Unknown')}` 
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
            <p>User <strong>${username}</strong> has successfully passed the Turnstile check on serververify.de5.net/vesper.</p>
            <p>They are awaiting your review in the server.</p>
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
                    // This will pass the exact error from Google Apps Script to your screen
                    throw new Error(emailResult.error || "Apps Script returned success: false");
                }
            } catch (e) {
                 // If it's not JSON, it might be an HTML login page
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
        // THIS IS THE MOST IMPORTANT PART - It sends the exact error to the red box
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
