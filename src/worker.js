export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/verify" && request.method === "POST") {
      try {
        const { username, turnstileToken } = await request.json();

        // 1. Validate Turnstile Token
        const turnstileData = new URLSearchParams();
        turnstileData.append('secret', env.TURNSTILE_SECRET_KEY);
        turnstileData.append('response', turnstileToken);

        const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: turnstileData 
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
        
        // Send as JSON this time
        const emailPayload = JSON.stringify({
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
          headers: { 'Content-Type': 'application/json' },
          body: emailPayload,
          redirect: 'manual' 
        });

        // Follow the redirect manually to get the final JSON response from Google
        if (initialResponse.status === 302) {
            const redirectUrl = initialResponse.headers.get('Location');
            const finalResponse = await fetch(redirectUrl, {
                method: 'GET'
            });

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
