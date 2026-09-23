  const loginForm = document.getElementById("loginForm"); // Make sure your <form> has id="loginForm"
  const errorMessage = document.getElementById("errorMessage"); // Optional element to show errors

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault(); // Stop the form from reloading the page

    // 1. Get input values from form fields
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

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
    }
  });