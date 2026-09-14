const express = require("express");
const router = express.Router();
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const Employee = require("../models/Employee");
const verifyToken = require("../middleware/auth");
const cloudinary = require("../config/cloudinary");

const SAMPLE_FACE_BOUNDS = {
    maxWidth: 1400,
    maxHeight: 1400,
    sampleWidth: 800,
    sampleHeight: 1200,
    aspectTolerance: 0.05,
    minSquareWidth: 300,
    minSquareHeight: 300,
    minPortraitWidth: 350,
    minPortraitHeight: 450
};

function validatePortraitMetadata(width, height) {
    if (!width || !height) {
        throw new Error("Your photo could not be validated. Please upload a clear portrait image.");
    }

    if (Math.max(width, height) > SAMPLE_FACE_BOUNDS.maxWidth) {
        throw new Error("Your photo is too large. Please upload a photo no larger than 1400 x 1400 pixels.");
    }

    const ratio = width / height;
    const referenceRatio = SAMPLE_FACE_BOUNDS.sampleWidth / SAMPLE_FACE_BOUNDS.sampleHeight;
    const portraitLower = referenceRatio * (1 - SAMPLE_FACE_BOUNDS.aspectTolerance);
    const portraitUpper = referenceRatio * (1 + SAMPLE_FACE_BOUNDS.aspectTolerance);
    const squareLower = 1.0 * (1 - SAMPLE_FACE_BOUNDS.aspectTolerance);
    const squareUpper = 1.0 * (1 + SAMPLE_FACE_BOUNDS.aspectTolerance);
    const isPortraitStyle = ratio >= portraitLower && ratio <= portraitUpper;
    const isSquareStyle = ratio >= squareLower && ratio <= squareUpper;

    if (!isPortraitStyle && !isSquareStyle) {
        throw new Error("Your photo does not match the required portrait layout. Please upload a front-facing portrait similar to the sample image.");
    }

    if (isPortraitStyle) {
        if (width < SAMPLE_FACE_BOUNDS.minPortraitWidth || height < SAMPLE_FACE_BOUNDS.minPortraitHeight) {
            throw new Error("Your photo is too small for the required portrait format. Minimum size is 350 x 450 px for a portrait-style upload.");
        }
    } else if (width < SAMPLE_FACE_BOUNDS.minSquareWidth || height < SAMPLE_FACE_BOUNDS.minSquareHeight) {
        throw new Error("Your photo is too small for the required portrait format. Minimum size is 300 x 300 px for a square-format upload.");
    }
}

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "nimc-employees",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [{ width: 500, height: 500, crop: "limit" }]
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"));
        }
    }
});

// ---------------------------------------------------------------
// REGISTER EMPLOYEE
// ---------------------------------------------------------------
router.post("/register", upload.single("photo"), async (req, res) => {
    try {
        const employeeData = { ...req.body };

        const submittedWidth = Number(req.body.photoWidth);
        const submittedHeight = Number(req.body.photoHeight);

        if (req.file || submittedWidth || submittedHeight) {
            validatePortraitMetadata(submittedWidth, submittedHeight);
        }

        if (req.file) {
            employeeData.photoUrl = req.file.path;
            employeeData.photoPublicId = req.file.filename;
        }

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
router.put("/:id", verifyToken, upload.single("photo"), async (req, res) => {
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
            if (employee.photoPublicId) {
                cloudinary.uploader.destroy(employee.photoPublicId).catch(() => {});
            }
            updates.photoUrl = req.file.path;
            updates.photoPublicId = req.file.filename;
        }

        const updatedEmployee = await Employee.findByIdAndUpdate(
            targetId,
            updates,
            { new: true, runValidators: true }
        ).select("-password");

        res.json({
            message: "Employee updated successfully",
            employee: updatedEmployee
        });

    } catch (error) {
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