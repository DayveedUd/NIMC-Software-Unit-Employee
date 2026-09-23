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
        window.location.href = `profile.html?id=${employee._id}`;
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
          resultsLabel.textContent = "Registered employees";
          emptyState.textContent = "No employees have registered yet.";
        } else {
          renderResults(allEmployees);
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
    // MEMO MANAGEMENT
    // ---------------------------------------------------------------
    const memoForm = document.getElementById("memoForm");
    const memoRecipient = document.getElementById("memoRecipient");
    const memoTitle = document.getElementById("memoTitle");
    const memoContent = document.getElementById("memoContent");
    const memoStatus = document.getElementById("memoStatus");
    const memoList = document.getElementById("memoList");
    let memoMode = "direct";

    function setMemoMode(mode) {
      memoMode = mode;
      document.querySelectorAll(".memo-toggle").forEach((button) => {
        button.classList.toggle("active", button.dataset.memoType === mode);
      });

      const isDirect = mode === "direct";
      memoRecipient.style.display = isDirect ? "block" : "none";
      memoRecipient.required = isDirect;
      memoForm.classList.toggle("active", true);
    }

    function populateMemoRecipientOptions(employees) {
      memoRecipient.innerHTML = '<option value="">Select employee</option>';

      employees.forEach((employee) => {
        const option = document.createElement("option");
        option.value = employee._id;
        option.textContent = `${employee.firstName} ${employee.lastName} (${employee.position})`;
        memoRecipient.appendChild(option);
      });
    }

    async function loadRecentMemos() {
      try {
        const response = await fetch("/api/memos", {
          headers: {
            "Authorization": `Bearer ${adminToken}`
          }
        });

        if (!response.ok) {
          throw new Error("Failed to load memos");
        }

        const memos = await response.json();
        memoList.innerHTML = "";

        if (!memos.length) {
          memoList.innerHTML = '<li class="memo-item"><strong>No memos sent yet.</strong><small>Direct or general memos will appear here.</small></li>';
          return;
        }

        memos.forEach((memo) => {
          const item = document.createElement("li");
          item.className = "memo-item";

          const recipientText = memo.recipient ? `${memo.recipient.firstName || ""} ${memo.recipient.lastName || ""}`.trim() : "All employees";
          item.innerHTML = `
            <strong>${memo.title}</strong>
            <small>${memo.type} • ${recipientText} • ${new Date(memo.createdAt).toLocaleString()}</small>
            <div>${memo.content}</div>
          `;
          memoList.appendChild(item);
        });
      } catch (error) {
        console.error(error);
        memoList.innerHTML = '<li class="memo-item"><strong>Unable to load memos.</strong><small>Please reload the dashboard.</small></li>';
      }
    }

    document.querySelectorAll(".memo-toggle").forEach((button) => {
      button.addEventListener("click", () => setMemoMode(button.dataset.memoType));
    });

    document.getElementById("clearMemoBtn").addEventListener("click", () => {
      memoForm.reset();
      memoStatus.textContent = "";
    });

    memoForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      memoStatus.textContent = "";

      const payload = {
        title: memoTitle.value.trim(),
        content: memoContent.value.trim()
      };

      if (!payload.title || !payload.content) {
        memoStatus.textContent = "Please complete the title and message.";
        return;
      }

      if (memoMode === "direct") {
        payload.recipientId = memoRecipient.value;
        if (!payload.recipientId) {
          memoStatus.textContent = "Please select an employee.";
          return;
        }
      }

      try {
        const response = await fetch(`/api/memos/${memoMode}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${adminToken}`
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Failed to send memo");
        }

        memoForm.reset();
        memoStatus.textContent = result.message || "Memo sent successfully.";
        await loadRecentMemos();
      } catch (error) {
        memoStatus.textContent = error.message;
      }
    });

    // ---------------------------------------------------------------
    // Kick things off
    loadEmployees().then(() => populateMemoRecipientOptions(allEmployees));
    setMemoMode("direct");
    loadRecentMemos();