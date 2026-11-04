  // ---------------------------------------------------------------
    // AUTH GUARD -- runs before anything else on this page.
    // If there's no token, this page's data is off-limits; send the
    // person to the login screen instead.
    // ---------------------------------------------------------------
    const adminToken = localStorage.getItem("adminToken");

    if (!adminToken) {
      window.location.href = "login.html";
    }

    document.getElementById("logoutBtn").addEventListener("click", function () {
      localStorage.removeItem("adminToken");
      window.location.href = "login.html";
    });

    // Footer button: Back to landing page
    document.getElementById("backBtn").addEventListener("click", function () {
      window.location.href = "index.html";
    });

   

    const resultsList = document.getElementById("results-list");
    const resultsLabel = document.getElementById("results-label");
    const emptyState = document.getElementById("empty-state");
    const searchInput = document.getElementById("search-input");
    const dashboardMain = document.getElementById("dashboardMain");
    const profilePanel = document.getElementById("profilePanel");
    const profileFrame = document.getElementById("profileFrame");

    function closeEmployeeProfile() {
      dashboardMain.classList.remove("profile-open");
      profilePanel.hidden = true;
      profileFrame.src = "about:blank";
    }

    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin || event.source !== profileFrame.contentWindow) {
        return;
      }

      if (event.data?.type === "employeeUpdated") {
        loadEmployees();
      } else if (event.data?.type === "closeEmployeeProfile") {
        closeEmployeeProfile();
      } else if (event.data?.type === "employeeDeleted") {
        closeEmployeeProfile();
        loadEmployees();
      }
    });

  

    // Person-icon SVG reused for every avatar (until a real photo is uploaded)
    const personIconSVG = `
      <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E4F" stroke-width="2">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
      </svg>`;

    let allEmployees = []; // holds everything fetched from the database

    // Build one result row (button) for a single employee record
    function createResultRow(employee) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "result-row";
      row.dataset.id = employee._id;

      const fullName = `${employee.firstName} ${employee.lastName}`;

      row.innerHTML = `
        <span class="avatar">
          ${employee.photoUrl ? `<img src="${employee.photoUrl}" alt="${fullName}" />` : personIconSVG}
        </span>
        <span class="result-info">
          <div class="name">${fullName}</div>
          <div class="role">${employee.position}</div>
        </span>
      `;

      row.addEventListener("click", function () {
        const profileUrl = `profile.html?id=${encodeURIComponent(employee._id)}`;
        if (window.matchMedia("(max-width: 600px)").matches) {
          window.location.href = `${profileUrl}&from=dashboard`;
          return;
        }

        dashboardMain.classList.add("profile-open");
        profilePanel.hidden = false;
        profileFrame.src = `${profileUrl}&embedded=1`;
      });

      return row;
    }

    // Render a given list of employees into the results grid
    function renderResults(employeeList) {
      resultsList.innerHTML = "";

      if (employeeList.length === 0) {
        emptyState.textContent = "No matching employees found.";
        return;
      }

      emptyState.textContent = "";
      employeeList.forEach(employee => {
        resultsList.appendChild(createResultRow(employee));
      });

    }

    // Fetch all registered employees from the backend
    async function loadEmployees() {
      emptyState.textContent = "Loading employees...";

      try {
        const response = await fetch("/api/employees", {
          headers: {
            "Authorization": `Bearer ${adminToken}`
          }
        });

        if (response.status === 401) {
          // Token missing/expired/invalid -- send back to login
          localStorage.removeItem("adminToken");
          window.location.href = "login.html";
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load employees");
        }

        allEmployees = await response.json();

        if (allEmployees.length === 0) {
          resultsList.innerHTML = "";
          resultsLabel.textContent = "Registered employees";
          emptyState.textContent = "No employees have registered yet.";
        } else {
          searchInput.dispatchEvent(new Event("input"));
        }

      } catch (error) {
        console.error(error);
        emptyState.textContent = "Could not load employees. Is the server running?";
      }
    }

    // Live search, filtering the already-fetched list (no extra requests needed)
    searchInput.addEventListener("input", function () {
      const searchText = this.value.toLowerCase();

      resultsLabel.textContent = searchText ? "Search results" : "Registered employees";

      const filtered = allEmployees.filter(employee => {
        const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
        const role = employee.position.toLowerCase();
        return fullName.includes(searchText) || role.includes(searchText);
      });

      renderResults(filtered);
    });


    

    // ---------------------------------------------------------------
    // Kick things off
    loadEmployees();
