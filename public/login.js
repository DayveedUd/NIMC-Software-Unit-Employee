 // Toggle the password field between hidden (dots) and visible (plain text)
    const passwordInput = document.getElementById("password");
    const togglePasswordBtn = document.getElementById("togglePassword");
    const eyeIcon = document.getElementById("eyeIcon");

    const eyeOpenPath = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
      <circle cx="12" cy="12" r="3"/>
    `;

    const eyeClosedPath = `
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.7 19.7 0 0 1 4.22-5.94"/>
      <path d="M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a19.6 19.6 0 0 1-2.16 3.19"/>
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    `;

    togglePasswordBtn.addEventListener("click", function () {
      const isHidden = passwordInput.type === "password";

      passwordInput.type = isHidden ? "text" : "password";
      eyeIcon.innerHTML = isHidden ? eyeClosedPath : eyeOpenPath;
      togglePasswordBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });

    const form = document.getElementById("loginForm");
    const loginError = document.getElementById("loginError");

    // If already logged in with a token that hasn't expired, skip the login screen
    const existingToken = localStorage.getItem("adminToken");
    if (existingToken) {
      window.location.href = "admin-dashboard.html";
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const loginBtn = document.getElementById("loginBtn");
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;

      loginError.classList.remove("visible");

      if (!username || !password) {
        loginError.textContent = "Please enter both a username and password.";
        loginError.classList.add("visible");
        return;
      }

      loginBtn.disabled = true;
      loginBtn.textContent = "Logging in...";

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
          loginError.textContent = data.message || "Login failed.";
          loginError.classList.add("visible");
          return;
        }

        // Store the token; every protected request from now on will include it
        localStorage.setItem("adminToken", data.token);
        window.location.href = "admin-dashboard.html";

      } catch (error) {
        console.error(error);
        loginError.textContent = "Could not reach the server. Is it running?";
        loginError.classList.add("visible");

      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "Log in";
      }

 
    });