const days = document.querySelectorAll(".day");

days.forEach(day => {
    day.addEventListener("click", function () {
        this.classList.toggle("active");
    });
});

// Show feedback once a photo is chosen
const photoInput = document.getElementById("photo");
const uploadStatus = document.getElementById("uploadStatus");
let pendingProfilePhotoFile = null;

const cropController = FaceAwareUpload.init({
    photoInputId: "photo",
    uploadStatusId: "uploadStatus",
    cropModalId: "photoCropModal",
    cropPreviewId: "cropPreview",
    cropZoomInId: "cropZoomIn",
    cropZoomOutId: "cropZoomOut",
    cropResetId: "cropReset",
    cropSaveId: "cropSave",
    cropCancelId: "cropCancel",
    onFileReady: function (file) {
        pendingProfilePhotoFile = file;
    },
    onError: function (message) {
        uploadStatus.textContent = message;
        uploadStatus.classList.remove("success");
        uploadStatus.classList.add("error");
    }
});

photoInput.addEventListener("change", function () {
    pendingProfilePhotoFile = null;
});

const form = document.getElementById("registrationForm");

// ---------------------------------------------------------------
// VALIDATION FUNCTIONS
// ---------------------------------------------------------------
function showError(inputEl, errorEl) {
    inputEl.classList.add("error");
    errorEl.classList.add("visible");
}

function clearError(inputEl, errorEl) {
    inputEl.classList.remove("error");
    errorEl.classList.remove("visible");
}

function validateForm() {
    let isValid = true;

    function requireText(id) {
        const input = document.getElementById(id);
        const error = document.getElementById(id + "Error");
        if (input.value.trim() === "") {
            showError(input, error);
            isValid = false;
        } else {
            clearError(input, error);
        }
    }

    requireText("firstName");
    requireText("lastName");
    requireText("school");
    requireText("discipline");
    requireText("skill");

    // Username validation (At least 3 characters)
    const usernameInput = document.getElementById("username");
    const usernameError = document.getElementById("usernameError");
    if (usernameInput.value.trim().length < 3) {
        showError(usernameInput, usernameError);
        isValid = false;
    } else {
        clearError(usernameInput, usernameError);
    }

    // Password validation (At least 6 characters)
    const passwordInput = document.getElementById("password");
    const passwordError = document.getElementById("passwordError");
    if (passwordInput.value.length < 6) {
        showError(passwordInput, passwordError);
        isValid = false;
    } else {
        clearError(passwordInput, passwordError);
    }

    // Email validation
    const emailInput = document.getElementById("email");
    const emailError = document.getElementById("emailError");
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(emailInput.value.trim())) {
        showError(emailInput, emailError);
        isValid = false;
    } else {
        clearError(emailInput, emailError);
    }

    // Phone validation
    const phoneInput = document.getElementById("phone");
    const phoneError = document.getElementById("phoneError");
    const digitsOnly = phoneInput.value.replace(/[\s-]/g, "");
    const phonePattern = /^\d{10,15}$/;
    if (!phonePattern.test(digitsOnly)) {
        showError(phoneInput, phoneError);
        isValid = false;
    } else {
        clearError(phoneInput, phoneError);
    }

    // Work days validation
    const workDaysError = document.getElementById("workDaysError");
    const anyDaySelected = document.querySelectorAll(".day.active").length > 0;
    if (!anyDaySelected) {
        workDaysError.classList.add("visible");
        isValid = false;
    } else {
        workDaysError.classList.remove("visible");
    }

    return isValid;
}

// Clear field errors on input
["firstName", "lastName", "username", "password", "school", "discipline", "skill", "email", "phone"].forEach(id => {
    const input = document.getElementById(id);
    const error = document.getElementById(id + "Error");
    if (input && error) {
        input.addEventListener("input", () => clearError(input, error));
    }
});

document.querySelectorAll(".day").forEach(day => {
    day.addEventListener("click", () => {
        document.getElementById("workDaysError").classList.remove("visible");
    });
});

// ---------------------------------------------------------------
// SUBMIT HANDLER
// ---------------------------------------------------------------
form.addEventListener("submit", async function(e) {
    e.preventDefault();

    if (!validateForm()) {
        return;
    }

    const submitBtn = document.querySelector(".submit-btn");
    const formData = new FormData();

    // Text & Password fields
    formData.append("firstName", document.getElementById("firstName").value.trim());
    formData.append("lastName", document.getElementById("lastName").value.trim());
    formData.append("username", document.getElementById("username").value.trim());
    formData.append("password", document.getElementById("password").value);
    formData.append("position", document.getElementById("position").value);
    formData.append("school", document.getElementById("school").value.trim());
    formData.append("discipline", document.getElementById("discipline").value.trim());
    formData.append("skill", document.getElementById("skill").value.trim());
    formData.append("phone", document.getElementById("phone").value.trim());
    formData.append("email", document.getElementById("email").value.trim());

    // Work days array
    document.querySelectorAll(".day.active").forEach(day => {
        formData.append("workDays", day.textContent);
    });

    if (!pendingProfilePhotoFile) {
        alert("A photo is required. Complete the face check and save a crop where the face/head occupies 50%–75% of the image height.");
        return;
    }

    formData.append("photo", pendingProfilePhotoFile);

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        const response = await fetch("/api/employees/register", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message || "Registration successful!");
            window.location.href = "employee-login.html"; // Send employee straight to login
        } else {
            alert(data.message || "Registration failed.");
        }

    } catch(error) {
        console.error("Registration error:", error);
        alert("Registration failed. Could not connect to server.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
    }
});