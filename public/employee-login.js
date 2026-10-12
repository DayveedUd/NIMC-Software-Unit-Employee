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

  const loginForm = document.getElementById("loginForm"); // Make sure your <form> has id="loginForm"
  const errorMessage = document.getElementById("errorMessage"); // Optional element to show errors

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault(); // Stop the form from reloading the page

    // 1. Get input values from form fields
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const loginBtn = document.getElementById("loginBtn");

    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    try {
      // 2. Send login credentials to backend
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        // 3. Store authentication details in localStorage
        if (data.role === "admin") {
          localStorage.setItem("adminToken", data.token);
          window.location.href = "admin-dashboard.html";
        } else {
          localStorage.setItem("employeeToken", data.token);
          localStorage.setItem("employeeId", data.employeeId);
          window.location.href = "profile.html"; // Redirect employee to their profile
        }
      } else {
        // Display error returned from server (e.g. "Invalid username or password")
        alert(data.message || "Login failed.");
      }

    } catch (error) {
      console.error("Login error:", error);
      alert("Server error. Please check if the backend is running.");
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Login";
    }
  });