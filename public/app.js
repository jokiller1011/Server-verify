let capToken = null;

// The real Cap widget triggers this function when solved
window.onCapSolve = function(event) {
    capToken = event.detail.token;
    document.getElementById('submit-btn').disabled = false;
};

document.getElementById('submit-btn').addEventListener('click', async () => {
    const username = document.getElementById('username').value.trim();
    const errorBox = document.getElementById('error-box');
    
    errorBox.classList.add('hidden');
    errorBox.innerText = '';

    if (!username) {
        errorBox.innerText = "Please enter a username.";
        errorBox.classList.remove('hidden');
        return;
    }
    if (!capToken) {
        errorBox.innerText = "Please complete the CAPTCHA.";
        errorBox.classList.remove('hidden');
        return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerText = "Verifying...";

    try {
        // Send the real Cap token to our Worker
        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, capToken })
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
        errorBox.innerText = "Network Error: " + error.message;
        errorBox.classList.remove('hidden');
        btn.disabled = false;
        btn.innerText = "Verify";
    }
});
