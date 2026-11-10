let capToken = null;

// 1. The Cap widget calls this when solved successfully
window.onCapSolve = function(event) {
    capToken = event.detail.token;
    document.getElementById('submit-btn').disabled = false;
    
    // Hide error box if it was previously shown due to a CAPTCHA error
    const errorBox = document.getElementById('error-box');
    if (errorBox) {
        errorBox.classList.add('hidden');
        errorBox.innerText = '';
    }
};

// 2. Listen for the widget to throw an error and display the exact code
document.addEventListener('DOMContentLoaded', () => {
    const widget = document.getElementById('cap-widget');
    if (widget) {
        widget.addEventListener('error', (event) => {
            console.error("Cap Widget Error Code:", event.detail.code);
            console.error("Cap Widget Error Message:", event.detail.message);
            
            const errorBox = document.getElementById('error-box');
            if (errorBox) {
                errorBox.innerText = `CAPTCHA Error: ${event.detail.code} - ${event.detail.message}`;
                errorBox.classList.remove('hidden');
            }
        });
    }
});

// 3. Handle the form submission
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
    if (!capToken) {
        errorBox.innerText = "Please complete the CAPTCHA.";
        errorBox.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    btn.innerText = "Verifying...";

    try {
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
