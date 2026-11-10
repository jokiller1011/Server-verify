let captchaSolved = false;
let captchaPayload = null;

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const DIFFICULTY = 4; // Must match the backend

async function solveChallenge(challenge) {
    let nonce = 0;
    let hash = '';
    while (true) {
        const input = challenge + nonce;
        hash = await sha256(input);
        if (hash.startsWith('0'.repeat(DIFFICULTY))) {
            return { challenge, nonce, hash };
        }
        nonce++;
        // Yield to the browser occasionally to keep the UI responsive
        if (nonce % 1000 === 0) {
            await new Promise(r => setTimeout(r, 0));
        }
    }
}

document.getElementById('submit-btn').addEventListener('click', async () => {
    const username = document.getElementById('username').value.trim();
    const errorBox = document.getElementById('error-box');
    const btn = document.getElementById('submit-btn');
    
    errorBox.classList.add('hidden');
    errorBox.innerText = '';

    if (!username) {
        errorBox.innerText = "Please enter a username.";
        errorBox.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    btn.innerText = "Generating challenge...";

    try {
        // 1. Get a challenge from the server
        const challengeRes = await fetch('/api/cap/challenge', { method: 'POST' });
        const { challenge } = await challengeRes.json();

        btn.innerText = "Solving CAPTCHA...";
        // 2. Solve the proof-of-work
        captchaPayload = await solveChallenge(challenge);
        captchaSolved = true;

        btn.innerText = "Verifying...";

        // 3. Send the solution and username to the server
        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, captcha: captchaPayload })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('form-step').classList.add('hidden');
            document.getElementById('success-step').classList.remove('hidden');
        } else {
            errorBox.innerText = data.message || "Unknown error occurred.";
            errorBox.classList.remove('hidden');
            btn.disabled = false;
            btn.innerText = "Verify";
        }
    } catch (error) {
        errorBox.innerText = "Error: " + error.message;
        errorBox.classList.remove('hidden');
        btn.disabled = false;
        btn.innerText = "Verify";
    }
});
