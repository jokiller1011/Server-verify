let turnstileToken = null;

// Called by Cloudflare when the checkbox is solved
window.onTurnstileSuccess = function(token) {
    turnstileToken = token;
    document.getElementById('submit-btn').disabled = false;
};

document.getElementById('submit-btn').addEventListener('click', async () => {
    const username = document.getElementById('username').value.trim();
    
    if (!username) {
        alert("Please enter a username.");
        return;
    }
    if (!turnstileToken) {
        alert("Please complete the CAPTCHA.");
        return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerText = "Verifying...";

    try {
        // This calls the Cloudflare Worker Function below
        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, turnstileToken })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('form-step').classList.add('hidden');
            document.getElementById('success-step').classList.remove('hidden');
        } else {
            alert("Verification failed. Please try again.");
            btn.disabled = false;
            btn.innerText = "Verify";
        }
    } catch (error) {
        alert("Server error. Please try again later.");
        btn.disabled = false;
        btn.innerText = "Verify";
    }
});
