export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/verify" && request.method === "POST") {
      try {
        const { username, turnstileToken } = await request.json();
        console.log("Received token from frontend:", turnstileToken); // Log incoming token

        // 1. Validate Turnstile Token
        const turnstileFormData = new FormData();
        turnstileFormData.append('secret', env.TURNSTILE_SECRET_KEY);
        turnstileFormData.append('response', turnstileToken);

        const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: turnstileFormData
        });
        const turnstileData = await turnstileResponse.json();
        console.log("Turnstile API Response:", JSON.stringify(turnstileData)); // Log Turnstile's full response

        if (!turnstileData.success) {
          return new Response(JSON.stringify({ success: false, message: 'Turnstile validation failed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 2. Send Email via Resend
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Vesper Verify <onboarding@resend.dev>',
            to: 'josiah.wilke77@outlook.com','josiah.wilke@huttoisd.org',
            subject: `New Server Verification: ${username}`,
            html: `<p>User <strong>${username}</strong> has successfully passed the Turnstile check.</p>`
          })
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error("Resend API Error:", errorText); // Log the exact error from Resend
          throw new Error("Failed to send email");
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error("Caught error:", error.message); // Log any other caught errors
        return new Response(JSON.stringify({ success: false, message: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
