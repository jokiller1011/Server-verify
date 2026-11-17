let capToken = null;

// Decode the pathname so %40 becomes @ before matching
const decodedPath = decodeURIComponent(window.location.pathname);
const pathMatch = decodedPath.match(/^\/@([^\/]+)$/);
const urlUsername = pathMatch ? pathMatch[1] : null;

// 1. The Cap widget calls this when solved successfully
window.onCapSolve = function(event) {
    capToken = event.detail.token;
    document.getElementById('submit-btn').disabled = false;
    
    const errorBox = document.getElementById('error-box');
    if (errorBox) {
        errorBox.classList.add('hidden');
        errorBox.innerText = '';
    }
};

// 2. Handle UI based on URL username on load
document.addEventListener('DOMContentLoaded', () => {
    if (urlUsername) {
        const input = document.getElementById('username');
        const instruction = document.getElementById('instruction-text');
        const loggedInMsg = document.getElementById('logged-in-message');
        const loggedInUser = document.getElementById('logged-in-username');

        if (input) input.classList.add('hidden');
        if (instruction) instruction.classList.add('hidden');
        if (loggedInMsg) loggedInMsg.classList.remove('hidden');
        if (loggedInUser) loggedInUser.textContent = `@${urlUsername}`;
    }

    // Cap widget error listener
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
    const errorBox = document.getElementById('error-box');
    const btn = document.getElementById('submit-btn');
    
    errorBox.classList.add('hidden');
    errorBox.innerText = '';

    // Determine username: prefer URL username, otherwise from input
    let username;
    if (urlUsername) {
        username = urlUsername;
    } else {
        const input = document.getElementById('username');
        username = input ? input.value.trim() : '';
    }

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
