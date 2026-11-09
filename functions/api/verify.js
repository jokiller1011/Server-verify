export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { username, turnstileToken } = await request.json();

        // 1. Validate Turnstile Token with Cloudflare
        const turnstileFormData = new FormData();
        turnstileFormData.append('secret', env.TURNSTILE_SECRET_KEY); // Set this in Cloudflare Dashboard
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

        // 2. Send Email using Resend API
        const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`, // Set this in Cloudflare Dashboard
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Vesper Verify <onboarding@resend.dev>', // Change to your verified domain in Resend
                to: 'admin@de5.net', // Your email address
                subject: `New Server Verification: ${username}`,
                html: `<p>User <strong>${username}</strong> has successfully passed the Turnstile check on serververify.de5.net/vesper.</p><p>They are awaiting your review in the server.</p>`
            })
        });

        if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error("Email API Error:", errorText);
            throw new Error("Failed to send email");
        }

        // 3. Return success to frontend
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
