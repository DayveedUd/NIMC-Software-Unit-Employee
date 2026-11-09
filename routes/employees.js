const express = require("express");
const router = express.Router();
const multer = require("multer");
const bcrypt = require("bcryptjs");

const Employee = require("../models/Employee");
const verifyToken = require("../middleware/auth");
const cloudinary = require("../config/cloudinary");

// Photos are held in memory so they can be validated BEFORE anything is
// uploaded to Cloudinary (rejected photos never reach storage).
function uploadPhotoToCloudinary(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "nimc-employees",
                allowed_formats: ["jpg", "jpeg", "png", "webp"],
                transformation: [{ width: 500, height: 500, crop: "limit" }]
            },
            (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(buffer);
    });
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"));
        }
    }
});

// Runs multer and returns JSON errors (file too large, wrong type) instead of
// letting Express send an HTML error page.
function photoUpload(req, res, next) {
    upload.single("photo")(req, res, function (err) {
        if (err) {
            const message = err.code === "LIMIT_FILE_SIZE"
                ? "Image is too large. The maximum size is 5MB."
                : err.message || "Photo upload failed.";
            return res.status(400).json({ message });
        }
        next();
    });
}

// ---------------------------------------------------------------
// REGISTER EMPLOYEE
// ---------------------------------------------------------------
router.post("/register", photoUpload, async (req, res) => {
    let uploadedPhoto = null;
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "A photo showing a human face is required to register."
            });
        }

        const employeeData = { ...req.body };

        uploadedPhoto = await uploadPhotoToCloudinary(req.file.buffer);
        employeeData.photoUrl = uploadedPhoto.secure_url;
        employeeData.photoPublicId = uploadedPhoto.public_id;

        if (employeeData.workDays && !Array.isArray(employeeData.workDays)) {
            employeeData.workDays = [employeeData.workDays];
        }

        // Hash password before saving
        if (employeeData.password) {
            employeeData.password = await bcrypt.hash(employeeData.password, 10);
        }

        const employee = new Employee(employeeData);
        await employee.save();

        res.status(201).json({
            message: "Employee registered successfully"
        });

    } catch (error) {
        // Don't leave an orphaned photo in Cloudinary if registration failed
        if (uploadedPhoto) {
            cloudinary.uploader.destroy(uploadedPhoto.public_id).catch(() => {});
        }

        if (error.code === 11000) {
            return res.status(409).json({
                message: "That username or email is already registered."
            });
        }

        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                message: messages.join(" ")
            });
        }

        if (error.message === "Only image files are allowed") {
            return res.status(400).json({
                message: error.message
            });
        }

        console.error(error);
        res.status(500).json({
            message: "Something went wrong on our end. Please try again."
        });
    }
});

// ---------------------------------------------------------------
// GET ALL EMPLOYEES (Admin Only)
// ---------------------------------------------------------------
router.get("/", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Admin only." });
        }

        const employees = await Employee.find().select("-password");
        res.json(employees);

    } catch(error) {
        res.status(500).json({ message: error.message });
    }
});

// ---------------------------------------------------------------
// GET SINGLE EMPLOYEE (Admin OR Self)
// ---------------------------------------------------------------
router.get("/:id", verifyToken, async (req, res) => {
    try {
        const requestedId = req.params.id;
        const isSelf = req.user.role === "employee" && req.user.id === requestedId;
        const isAdmin = req.user.role === "admin";

        if (!isAdmin && !isSelf) {
            return res.status(403).json({ message: "Access denied. You can only view your own profile." });
        }

        const employee = await Employee.findById(requestedId).select("-password");

        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        res.json(employee);

    } catch(error) {
        res.status(500).json({ message: error.message });
    }
});

// ---------------------------------------------------------------
// UPDATE EMPLOYEE (Admin OR Self)
// ---------------------------------------------------------------
router.put("/:id", verifyToken, photoUpload, async (req, res) => {
    let uploadedPhoto = null;
    try {
        const targetId = req.params.id;
        const isSelf = req.user.role === "employee" && req.user.id === targetId;
        const isAdmin = req.user.role === "admin";

        if (!isAdmin && !isSelf) {
            return res.status(403).json({ message: "Access denied. You can only update your own profile." });
        }

        const employee = await Employee.findById(targetId);

        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const updates = { ...req.body };

        if (updates.workDays && !Array.isArray(updates.workDays)) {
            updates.workDays = [updates.workDays];
        } else if (!updates.workDays) {
            updates.workDays = [];
        }

        // Hash new password if supplied in updates
        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
        } else {
            delete updates.password; // Prevent overwriting with empty string
        }

        if (req.file) {
            uploadedPhoto = await uploadPhotoToCloudinary(req.file.buffer);
            updates.photoUrl = uploadedPhoto.secure_url;
            updates.photoPublicId = uploadedPhoto.public_id;
        }

        const updatedEmployee = await Employee.findByIdAndUpdate(
            targetId,
            updates,
            { new: true, runValidators: true }
        ).select("-password");

        // Remove the replaced photo only after the update succeeded
        if (uploadedPhoto && employee.photoPublicId) {
            cloudinary.uploader.destroy(employee.photoPublicId).catch(() => {});
        }

        res.json({
            message: "Employee updated successfully",
            employee: updatedEmployee
        });

    } catch (error) {
        if (uploadedPhoto) {
            cloudinary.uploader.destroy(uploadedPhoto.public_id).catch(() => {});
        }

        if (error.code === 11000) {
            return res.status(409).json({ message: "Username or email is already taken." });
        }

        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: messages.join(" ") });
        }

        console.error(error);
        res.status(500).json({ message: "Something went wrong on our end. Please try again." });
    }
});

// ---------------------------------------------------------------
// DELETE EMPLOYEE (Admin Only)
// ---------------------------------------------------------------
router.delete("/:id", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Admin only." });
        }

        const employee = await Employee.findByIdAndDelete(req.params.id);

        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        if (employee.photoPublicId) {
            cloudinary.uploader.destroy(employee.photoPublicId).catch(() => {});
        }

        res.json({ message: "Employee deleted successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Something went wrong on our end. Please try again." });
    }
});

module.exports = router;