(function () {
  const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function isAcceptedImage(file) {
    const typeOk = ACCEPTED_TYPES.includes(file.type);
    const name = (file.name || "").toLowerCase();
    const extension = name.split(".").pop();
    const extOk = ACCEPTED_EXTENSIONS.includes(extension || "");
    return typeOk || extOk;
  }

  function validateImageFile(file) {
    if (!file) {
      throw new Error("Please choose an image to upload.");
    }

    if (!isAcceptedImage(file)) {
      throw new Error("Please upload a JPG, PNG, or WEBP image.");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Image is too large. Please choose a smaller image.");
    }

    return true;
  }

  function readImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function () {
        const img = new Image();
        img.onload = function () {
          resolve(img);
        };
        img.onerror = function () {
          reject(new Error("We couldn't analyze this image. Please try another photo."));
        };
        img.src = reader.result;
      };
      reader.onerror = function () {
        reject(new Error("We couldn't analyze this image. Please try another photo."));
      };
      reader.readAsDataURL(file);
    });
  }

  async function ensureFaceApiLoaded() {
    if (!window.faceapi) {
      throw new Error("Face detection is unavailable right now.");
    }

    const faceDetector = window.faceapi && window.faceapi.nets && window.faceapi.nets.tinyFaceDetector;
    if (!faceDetector) {
      throw new Error("Face detection library failed to load.");
    }

    if (!faceDetector.isLoaded) {
      const modelBase = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";
      await faceDetector.loadFromUri(modelBase);
    }

    return true;
  }

  async function detectSingleFace(file) {
    validateImageFile(file);

    const image = await readImageFromFile(file);
    await ensureFaceApiLoaded();

    const faceDetections = await window.faceapi.detectAllFaces(
      image,
      new window.faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
    );

    if (!faceDetections || faceDetections.length === 0) {
      throw new Error("No face detected. Please upload a clear photo showing a human face.");
    }

    if (faceDetections.length > 1) {
      throw new Error("Multiple faces detected. Please upload a photo with only one person.");
    }

    const face = faceDetections[0].box;
    return {
      image,
      face: {
        x: face.x,
        y: face.y,
        width: face.width,
        height: face.height
      }
    };
  }

  function computeInitialCropState(image, face) {
    const faceCenterX = face.x + (face.width / 2);
    const faceCenterY = face.y + (face.height / 2);
    const baseSize = Math.max(face.width, face.height) * 2.6;
    const size = clamp(baseSize, 200, Math.min(image.naturalWidth, image.naturalHeight));

    const centeredX = faceCenterX - (size / 2);
    const centeredY = faceCenterY - (size / 2);
    const clampedX = clamp(centeredX, 0, image.naturalWidth - size);
    const clampedY = clamp(centeredY, 0, image.naturalHeight - size);

    return {
      zoom: 1,
      offsetX: clampedX - centeredX,
      offsetY: clampedY - centeredY
    };
  }

  function getCropRect(image, face, zoom, offsetX, offsetY) {
    const faceCenterX = face.x + (face.width / 2);
    const faceCenterY = face.y + (face.height / 2);
    const baseSize = Math.max(face.width, face.height) * 2.6;
    const size = clamp(baseSize * zoom, 200, Math.min(image.naturalWidth, image.naturalHeight));

    let x = faceCenterX - (size / 2) + offsetX;
    let y = faceCenterY - (size / 2) + offsetY;

    x = clamp(x, 0, image.naturalWidth - size);
    y = clamp(y, 0, image.naturalHeight - size);

    return { x, y, size };
  }

  function addStatusClasses(statusElement, kind) {
    statusElement.classList.remove("error", "success", "loading");
    if (kind === "error") {
      statusElement.classList.add("error");
    }
    if (kind === "success") {
      statusElement.classList.add("success");
    }
    if (kind === "loading") {
      statusElement.classList.add("loading");
    }
  }

  function initFaceAwarePhotoUpload(options) {
    const {
      photoInputId,
      uploadStatusId,
      cropModalId,
      cropPreviewId,
      cropZoomInId,
      cropZoomOutId,
      cropResetId,
      cropSaveId,
      cropCancelId,
      onPreviewReady,
      onFileReady,
      onError,
      uploadPreviewAlt = "New profile photo preview"
    } = options;

    const photoInput = document.getElementById(photoInputId);
    const uploadStatus = document.getElementById(uploadStatusId);
    const cropModal = document.getElementById(cropModalId);
    const cropPreview = document.getElementById(cropPreviewId);
    const zoomInBtn = cropZoomInId ? document.getElementById(cropZoomInId) : null;
    const zoomOutBtn = cropZoomOutId ? document.getElementById(cropZoomOutId) : null;
    const resetBtn = cropResetId ? document.getElementById(cropResetId) : null;
    const saveBtn = cropSaveId ? document.getElementById(cropSaveId) : null;
    const cancelBtn = cropCancelId ? document.getElementById(cropCancelId) : null;

    if (!photoInput || !uploadStatus || !cropModal || !cropPreview) {
      return null;
    }

    let detectedImage = null;
    let detectedFace = null;
    let objectUrl = "";
    let lastCroppedFile = null;
    let cropState = { zoom: 1, offsetX: 0, offsetY: 0 };
    let isDragging = false;
    let dragStart = null;

    function setStatus(message, kind = "neutral") {
      uploadStatus.textContent = message;
      addStatusClasses(uploadStatus, kind);
    }

    function resetCropState() {
      if (detectedImage && detectedFace) {
        cropState = computeInitialCropState(detectedImage, detectedFace);
        return;
      }
      cropState = { zoom: 1, offsetX: 0, offsetY: 0 };
    }

    function clearObjectUrl() {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = "";
      }
    }

    function updateCropPreview() {
      if (!detectedImage || !detectedFace) return;

      const cropRect = getCropRect(
        detectedImage,
        detectedFace,
        cropState.zoom,
        cropState.offsetX,
        cropState.offsetY
      );

      const backgroundSizeX = (detectedImage.naturalWidth / cropRect.size) * 100;
      const backgroundSizeY = (detectedImage.naturalHeight / cropRect.size) * 100;
      const backgroundX = (-cropRect.x / detectedImage.naturalWidth) * 100;
      const backgroundY = (-cropRect.y / detectedImage.naturalHeight) * 100;

      cropPreview.style.backgroundImage = `url("${objectUrl}")`;
      cropPreview.style.backgroundSize = `${backgroundSizeX}% ${backgroundSizeY}%`;
      cropPreview.style.backgroundPosition = `${backgroundX}% ${backgroundY}%`;
      cropPreview.style.backgroundRepeat = "no-repeat";
      cropPreview.setAttribute("aria-label", uploadPreviewAlt);
    }

    function openCropDialog() {
      cropModal.classList.add("active");
      updateCropPreview();
    }

    function closeCropDialog() {
      cropModal.classList.remove("active");
    }

    function handleDragStart(event) {
      if (!detectedImage) return;
      isDragging = true;
      dragStart = { x: event.clientX, y: event.clientY };
      cropPreview.setPointerCapture && cropPreview.setPointerCapture(event.pointerId);
    }

    function handleDragMove(event) {
      if (!isDragging || !dragStart || !detectedImage) return;

      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      dragStart = { x: event.clientX, y: event.clientY };

      cropState.offsetX += (deltaX / cropPreview.clientWidth) * detectedImage.naturalWidth;
      cropState.offsetY += (deltaY / cropPreview.clientHeight) * detectedImage.naturalHeight;
      updateCropPreview();
    }

    function handleDragEnd() {
      isDragging = false;
      dragStart = null;
    }

    cropPreview.addEventListener("pointerdown", handleDragStart);
    cropPreview.addEventListener("pointermove", handleDragMove);
    cropPreview.addEventListener("pointerup", handleDragEnd);
    cropPreview.addEventListener("pointerleave", handleDragEnd);

    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", function () {
        cropState.zoom = clamp(cropState.zoom + 0.12, 1, 2.5);
        updateCropPreview();
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", function () {
        cropState.zoom = clamp(cropState.zoom - 0.12, 1, 2.5);
        updateCropPreview();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        resetCropState();
        updateCropPreview();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        closeCropDialog();
        photoInput.value = "";
        lastCroppedFile = null;
        clearObjectUrl();
        detectedImage = null;
        detectedFace = null;
        setStatus("No file selected", "neutral");
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", async function () {
        if (!detectedImage || !detectedFace) return;

        const cropRect = getCropRect(
          detectedImage,
          detectedFace,
          cropState.zoom,
          cropState.offsetX,
          cropState.offsetY
        );

        const canvas = document.createElement("canvas");
        const outputSize = 512;
        canvas.width = outputSize;
        canvas.height = outputSize;

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, outputSize, outputSize);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, outputSize, outputSize);
        ctx.drawImage(
          detectedImage,
          cropRect.x,
          cropRect.y,
          cropRect.size,
          cropRect.size,
          0,
          0,
          outputSize,
          outputSize
        );

        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, "image/jpeg", 0.9);
        });

        if (!blob) {
          throw new Error("Your profile picture could not be processed. Please try again.");
        }

        const sourceName = (photoInput.files && photoInput.files[0] && photoInput.files[0].name) || "profile-picture.jpg";
        const fileName = sourceName.replace(/\.[^/.]+$/, "") + ".jpg";
        lastCroppedFile = new File([blob], fileName, { type: "image/jpeg" });

        if (typeof onFileReady === "function") {
          onFileReady(lastCroppedFile);
        }

        if (typeof onPreviewReady === "function") {
          onPreviewReady(URL.createObjectURL(lastCroppedFile), uploadPreviewAlt);
        }

        closeCropDialog();
        setStatus("✓ " + fileName, "success");
      });
    }

    photoInput.addEventListener("change", async function () {
      const file = this.files && this.files[0];
      if (!file) return;

      try {
        validateImageFile(file);
        setStatus("Analyzing image…", "loading");

        const faceData = await detectSingleFace(file);
        const previewUrl = URL.createObjectURL(file);

        clearObjectUrl();
        objectUrl = previewUrl;
        detectedImage = faceData.image;
        detectedFace = faceData.face;
        lastCroppedFile = null;
        cropState = computeInitialCropState(detectedImage, detectedFace);

        if (typeof onPreviewReady === "function") {
          onPreviewReady(previewUrl, uploadPreviewAlt);
        }

        openCropDialog();
      } catch (error) {
        this.value = "";
        if (typeof onError === "function") {
          onError(error.message || "We couldn't analyze this image. Please try another photo.");
        }
        setStatus(error.message || "We couldn't analyze this image. Please try another photo.", "error");
        clearObjectUrl();
        detectedImage = null;
        detectedFace = null;
        lastCroppedFile = null;
      }
    });

    return {
      getLastCroppedFile: function () {
        return lastCroppedFile;
      },
      clearLastCroppedFile: function () {
        lastCroppedFile = null;
      },
      getCurrentStatus: function () {
        return uploadStatus.textContent;
      },
      resetUpload: function () {
        photoInput.value = "";
        clearObjectUrl();
        detectedImage = null;
        detectedFace = null;
        lastCroppedFile = null;
        setStatus("No file selected", "neutral");
        closeCropDialog();
      }
    };
  }

  window.FaceAwareUpload = {
    init: initFaceAwarePhotoUpload
  };
})();
