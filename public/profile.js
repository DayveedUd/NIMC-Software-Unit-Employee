// ---------------------------------------------------------------
// 1. AUTH GUARD & ROLE DETECTION
// ---------------------------------------------------------------
const adminToken = localStorage.getItem("adminToken");
const employeeToken = localStorage.getItem("employeeToken");

if (!adminToken && !employeeToken) {
  window.location.href = "employee-login.html";
}

const isAdmin = Boolean(adminToken);
const activeToken = adminToken || employeeToken;

const params = new URLSearchParams(window.location.search);
const urlEmployeeId = params.get("id");
const targetEmployeeId = isAdmin ? (urlEmployeeId || localStorage.getItem("employeeId")) : localStorage.getItem("employeeId");

const statusMessage = document.getElementById("statusMessage");
const profileContent = document.getElementById("profileContent");
const profileCard = document.getElementById("profileCard");

const editBtn = document.getElementById("editBtn");
const deleteBtn = document.getElementById("deleteBtn");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");
const photoInput = document.getElementById("photoInput");
const avatar = document.getElementById("avatar");
const backBtn = document.getElementById("backBtn");

let currentEmployee = null;
let selectedPhotoFile = null;
let pendingProfilePhotoFile = null;
let faceAwareController = null;

// Adjust button visibility based on role
if (!isAdmin) {
  // Employee View: Show Edit button, hide Delete button
  if (editBtn) editBtn.style.display = "inline-flex";
  if (deleteBtn) deleteBtn.style.display = "none";
  
  if (backBtn) {
    backBtn.onclick = function () {
      localStorage.removeItem("employeeToken");
      localStorage.removeItem("employeeId");
      window.location.href = "employee-login.html";
    };
  }
} else {
  // Admin View: Hide Edit button, show Delete button
  if (editBtn) editBtn.style.display = "none";
  if (deleteBtn) deleteBtn.style.display = "inline-flex";

  if (backBtn) {
    backBtn.onclick = function () {
      window.location.href = "admin-dashboard.html";
    };
  }
}

// ---------------------------------------------------------------
// 2. RENDER & LOAD PROFILE DATA
// ---------------------------------------------------------------
function renderProfile(data) {
  currentEmployee = data;

  const fullName = `${data.firstName} ${data.lastName}`;
  document.getElementById("fullName").textContent = fullName;
  document.getElementById("positionBadge").textContent = data.position;
  document.getElementById("phoneValue").textContent = data.phone;
  document.getElementById("emailValue").textContent = data.email;
  document.getElementById("schoolValue").textContent = data.school;
  document.getElementById("disciplineValue").textContent = data.discipline;
  document.getElementById("skillValue").textContent = data.skill;

  document.querySelectorAll(".day").forEach(dayEl => {
    dayEl.classList.toggle("active", data.workDays ? data.workDays.includes(dayEl.dataset.day) : false);
  });

  avatar.innerHTML = data.photoUrl
    ? `<img src="${data.photoUrl}" alt="${fullName}" />`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="#0B6E4F" stroke-width="2">
         <circle cx="12" cy="8" r="4"/>
         <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
       </svg>`;

  statusMessage.style.display = "none";
  profileContent.style.display = "block";
}

async function loadProfile() {
  if (!targetEmployeeId) {
    statusMessage.textContent = "No employee profile selected.";
    return;
  }

  try {
    const response = await fetch(`/api/employees/${targetEmployeeId}`, {
      headers: {
        "Authorization": `Bearer ${activeToken}`
      }
    });

    if (response.status === 401) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("employeeToken");
      window.location.href = "employee-login.html";
      return;
    }

    if (response.status === 404) {
      statusMessage.textContent = "Employee profile not found.";
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to load employee profile");
    }

    const employee = await response.json();
    renderProfile(employee);

  } catch (error) {
    console.error(error);
    statusMessage.textContent = "Could not load profile. Is the server running?";
  }
}

// ---------------------------------------------------------------
// 3. EDIT MODE HANDLERS
// ---------------------------------------------------------------
function enterEditMode() {
  document.getElementById("firstNameInput").value = currentEmployee.firstName || "";
  document.getElementById("lastNameInput").value = currentEmployee.lastName || "";
  document.getElementById("positionInput").value = currentEmployee.position || "Intern";
  document.getElementById("phoneInput").value = currentEmployee.phone || "";
  document.getElementById("emailInput").value = currentEmployee.email || "";
  document.getElementById("schoolInput").value = currentEmployee.school || "";
  document.getElementById("disciplineInput").value = currentEmployee.discipline || "";
  document.getElementById("skillInput").value = currentEmployee.skill || "";

  selectedPhotoFile = null;
  pendingProfilePhotoFile = null;
  photoInput.value = "";

  profileCard.classList.add("editing");
}

function exitEditMode() {
  profileCard.classList.remove("editing");
  selectedPhotoFile = null;
  pendingProfilePhotoFile = null;
  if (faceAwareController && typeof faceAwareController.resetUpload === "function") {
    faceAwareController.resetUpload();
  }
}

if (editBtn) {
  editBtn.addEventListener("click", enterEditMode);
}

cancelBtn.addEventListener("click", function () {
  exitEditMode();
  renderProfile(currentEmployee);
});

document.querySelectorAll(".day").forEach(dayEl => {
  dayEl.addEventListener("click", function () {
    if (profileCard.classList.contains("editing")) {
      this.classList.toggle("active");
    }
  });
});

faceAwareController = FaceAwareUpload.init({
  photoInputId: "photoInput",
  uploadStatusId: "statusMessage",
  cropModalId: "photoCropModal",
  cropPreviewId: "cropPreview",
  cropZoomInId: "cropZoomIn",
  cropZoomOutId: "cropZoomOut",
  cropResetId: "cropReset",
  cropSaveId: "cropSave",
  cropCancelId: "cropCancel",
  onPreviewReady: function (previewUrl) {
    avatar.innerHTML = `<img src="${previewUrl}" alt="New photo preview" />`;
  },
  onFileReady: function (file) {
    pendingProfilePhotoFile = file;
    selectedPhotoFile = file;
  },
  onError: function (message) {
    alert(message);
  }
});

// ---------------------------------------------------------------
// 4. SAVE PROFILE (PUT /api/employees/:id)
// ---------------------------------------------------------------
saveBtn.addEventListener("click", async function () {
  const formData = new FormData();
  formData.append("firstName", document.getElementById("firstNameInput").value.trim());
  formData.append("lastName", document.getElementById("lastNameInput").value.trim());
  formData.append("position", document.getElementById("positionInput").value);
  formData.append("phone", document.getElementById("phoneInput").value.trim());
  formData.append("email", document.getElementById("emailInput").value.trim());
  formData.append("school", document.getElementById("schoolInput").value.trim());
  formData.append("discipline", document.getElementById("disciplineInput").value.trim());
  formData.append("skill", document.getElementById("skillInput").value.trim());

  document.querySelectorAll(".day.active").forEach(day => {
    formData.append("workDays", day.dataset.day);
  });

  const photoFileToUpload = pendingProfilePhotoFile || selectedPhotoFile;
  if (photoFileToUpload) {
    formData.append("photo", photoFileToUpload);
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const response = await fetch(`/api/employees/${targetEmployeeId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${activeToken}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Update failed.");
      return;
    }

    exitEditMode();
    renderProfile(data.employee);

  } catch (error) {
    console.error(error);
    alert("Update failed. Is the server running?");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save changes";
  }
});

// ---------------------------------------------------------------
// 5. DELETE PROFILE (Admin Only)
// ---------------------------------------------------------------
if (deleteBtn) {
  deleteBtn.addEventListener("click", async function () {
    if (!isAdmin) return;

    const fullName = currentEmployee ? `${currentEmployee.firstName} ${currentEmployee.lastName}` : "this employee";
    const confirmed = confirm(`Delete ${fullName}? This can't be undone.`);

    if (!confirmed) return;

    deleteBtn.disabled = true;

    try {
      const response = await fetch(`/api/employees/${targetEmployeeId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${adminToken}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Delete failed.");
        deleteBtn.disabled = false;
        return;
      }

      alert(data.message);
      window.location.href = "admin-dashboard.html";

    } catch (error) {
      console.error(error);
      alert("Delete failed. Is the server running?");
      deleteBtn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------
// 6. LIGHTBOX MODAL
// ---------------------------------------------------------------
const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const modalCloseBtn = document.getElementById("modalCloseBtn");

avatar.addEventListener("click", function () {
  if (profileCard.classList.contains("editing")) return;
  const img = avatar.querySelector("img");
  if (img) {
    modalImage.src = img.src;
    imageModal.classList.add("active");
  }
});

modalCloseBtn.addEventListener("click", () => imageModal.classList.remove("active"));
imageModal.addEventListener("click", (e) => {
  if (e.target === imageModal) imageModal.classList.remove("active");
});

// ---------------------------------------------------------------
  // 7. MEMO INBOX
  // ---------------------------------------------------------------
  const memoList = document.getElementById("memoList");

  function renderMemoList(memos) {
    memoList.innerHTML = "";

    if (!memos.length) {
      memoList.innerHTML = '<li class="memo-empty">No memos yet. Check back later.</li>';
      return;
    }

    memos.forEach((memo) => {
      const isRead = memo.readBy && memo.readBy.some((entry) => String(entry.employee) === String(targetEmployeeId));

      const item = document.createElement("li");
      item.className = "memo-item";
      item.innerHTML = `
        <div class="memo-item-header">
          <div>
            <div class="memo-item-title">${memo.title}</div>
            <div class="memo-item-meta">${memo.type} • ${memo.senderName || "Admin"} • ${new Date(memo.createdAt).toLocaleString()}</div>
          </div>
          ${isRead ? '<span class="memo-pill">Read</span>' : '<span class="memo-pill">Unread</span>'}
        </div>
        <div class="memo-item-content">${memo.content}</div>
        <div class="memo-actions">
          ${isRead ? '<button type="button" class="memo-read-btn" disabled>Marked read</button>' : `<button type="button" class="memo-read-btn" data-id="${memo._id}">Mark as read</button>`}
        </div>
      `;

      const readButton = item.querySelector(".memo-read-btn");
      if (readButton && !readButton.disabled) {
        readButton.addEventListener("click", async () => {
          try {
            const response = await fetch(`/api/memos/${memo._id}/read`, {
              method: "PATCH",
              headers: {
                "Authorization": `Bearer ${activeToken}`
              }
            });

            const result = await response.json();
            if (!response.ok) {
              throw new Error(result.message || "Unable to mark memo as read");
            }

            await loadEmployeeMemos();
          } catch (error) {
            alert(error.message);
          }
        });
      }

      memoList.appendChild(item);
    });
  }

  async function loadEmployeeMemos() {
    if (!employeeToken || !targetEmployeeId) {
      memoList.innerHTML = '<li class="memo-empty">Memo inbox is only available for signed-in employees.</li>';
      return;
    }

    try {
      const response = await fetch("/api/memos", {
        headers: {
          "Authorization": `Bearer ${activeToken}`
        }
      });

      if (!response.ok) {
        throw new Error("Unable to load memos");
      }

      const memos = await response.json();
      renderMemoList(memos);
    } catch (error) {
      console.error(error);
      memoList.innerHTML = '<li class="memo-empty">Could not load memos right now.</li>';
    }
  }

  // Initialize
  loadProfile();
  loadEmployeeMemos();