// A simple, dependency-free proof-of-work CAPTCHA
const DIFFICULTY = 4; // Number of leading zeros required in the hash

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Endpoint to generate a new challenge
    if (url.pathname === '/api/cap/challenge' && request.method === 'POST') {
        // Generate a random challenge string (16 bytes hex)
        const challenge = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        return new Response(JSON.stringify({ challenge }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 2. Final verification endpoint
    if (url.pathname === "/api/verify" && request.method === "POST") {
      try {
        const { username, captcha } = await request.json();

        if (!captcha || !captcha.challenge || captcha.nonce === undefined) {
            throw new Error("Missing CAPTCHA data.");
        }

        const { challenge, nonce } = captcha;

        // Recompute the hash to verify the solution
        const input = challenge + nonce;
        const hashHex = await sha256(input);

        // Check if the hash meets the difficulty
        if (!hashHex.startsWith('0'.repeat(DIFFICULTY))) {
            throw new Error("Invalid CAPTCHA solution.");
        }

        // Send Email via Google Apps Script
        const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbwXD31EDB3-JiRGnKfC2U_rz3owT8cbNlQWh6pFUqBbe98LneCGWpG_LsuOMr2RUIps/exec';
        
        const emailPayload = JSON.stringify({
          to: 'josiah.wilke@huttoisd.org',
          subject: `New Server Verification: ${username}`,
          htmlBody: `
            <h3>New Verification Request</h3>
            <p>User <strong>${username}</strong> has successfully passed the CAPTCHA on serververify.de5.net/vesper.</p>
          `
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
