export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle the API request for verification
    if (url.pathname === "/api/verify" && request.method === "POST") {
      try {
        const { username, turnstileToken } = await request.json();

        // 1. Validate Turnstile Token with Cloudflare
        const turnstileFormData = new FormData();
        turnstileFormData.append('secret', env.TURNSTILE_SECRET_KEY);
        turnstileFormData.append('response', turnstileToken);

        const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: turnstileFormData
        });
        const turnstileData = await turnstileResponse.json();

        if (!turnstileData.success) {
          return new Response(JSON.stringify({ success: false, message: 'Turnstile validation failed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 2. Send Email via Resend API
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Vesper Verify <onboarding@resend.dev>', // Update if you verified a custom domain on Resend
            to: 'admin@de5.net',
            subject: `New Server Verification: ${username}`,
            html: `<p>User <strong>${username}</strong> has successfully passed the Turnstile check on serververify.de5.net/vesper.</p>`
          })
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error("Resend Error:", errorText);
          throw new Error("Failed to send email");
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ success: false, message: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Serve static files from the public folder for all other routes
    return env.ASSETS.fetch(request);
  }
};
