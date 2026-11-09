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
        
        const emailPayload = {
          to: 'josiah.wilke@huttoisd.org',
          subject: `New Server Verification: ${username}`,
          htmlBody: `
            <h3>New Verification Request</h3>
            <p>User <strong>${username}</strong> has successfully passed the Turnstile check on serververify.de5.net/vesper.</p>
            <p>They are awaiting your review in the server.</p>
          `
        };

        const emailResponse = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload)
        });

        const emailResult = await emailResponse.json();
        console.log("Apps Script Response:", emailResult);

        if (!emailResult.success) {
          throw new Error(emailResult.error || "Failed to send email via Apps Script");
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error("Caught error:", error.message);
        return new Response(JSON.stringify({ success: false, message: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
