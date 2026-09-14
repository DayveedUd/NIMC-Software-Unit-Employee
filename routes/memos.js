const express = require("express");
const router = express.Router();

const Memo = require("../models/Memo");
const Employee = require("../models/Employee");
const verifyToken = require("../middleware/auth");

router.get("/", verifyToken, async (req, res) => {
    try {
        if (req.user.role === "admin") {
            const memos = await Memo.find()
                .populate("recipient", "firstName lastName position")
                .sort({ createdAt: -1 })
                .limit(100);

            return res.json(memos);
        }

        const memos = await Memo.find({ recipient: req.user.id })
            .populate("recipient", "firstName lastName position")
            .sort({ createdAt: -1 });

        return res.json(memos);
    } catch (error) {
        console.error("Fetch memos error:", error);
        return res.status(500).json({ message: "Unable to load memos." });
    }
});

router.post("/direct", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Admin only." });
        }

        const { recipientId, title, content } = req.body;

        if (!recipientId || !title || !content) {
            return res.status(400).json({ message: "Recipient, title, and content are required." });
        }

        const employee = await Employee.findById(recipientId);
        if (!employee) {
            return res.status(404).json({ message: "Employee not found." });
        }

        const memo = await Memo.create({
            sender: null,
            senderName: req.user.username || "Admin",
            recipient: employee._id,
            type: "DIRECT",
            title: String(title).trim(),
            content: String(content).trim(),
        });

        return res.status(201).json({
            message: "Direct memo sent successfully.",
            memo
        });
    } catch (error) {
        console.error("Create direct memo error:", error);
        return res.status(500).json({ message: "Unable to send direct memo." });
    }
});

router.post("/general", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Admin only." });
        }

        const { title, content } = req.body;

        if (!title || !content) {
            return res.status(400).json({ message: "Title and content are required." });
        }

        const employees = await Employee.find().select("_id");

        if (!employees.length) {
            return res.status(400).json({ message: "There are no employees to send the memo to." });
        }

        const memoPayloads = employees.map((employee) => ({
            sender: null,
            senderName: req.user.username || "Admin",
            recipient: employee._id,
            type: "GENERAL",
            title: String(title).trim(),
            content: String(content).trim(),
        }));

        const createdMemos = await Memo.insertMany(memoPayloads);

        return res.status(201).json({
            message: "General memo sent successfully.",
            count: createdMemos.length
        });
    } catch (error) {
        console.error("Create general memo error:", error);
        return res.status(500).json({ message: "Unable to send general memo." });
    }
});

router.patch("/:id/read", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "employee") {
            return res.status(403).json({ message: "Access denied. Employees only." });
        }

        const memo = await Memo.findById(req.params.id);

        if (!memo) {
            return res.status(404).json({ message: "Memo not found." });
        }

        if (String(memo.recipient) !== String(req.user.id)) {
            return res.status(403).json({ message: "This memo is not assigned to you." });
        }

        const alreadyRead = memo.readBy.some((entry) => String(entry.employee) === String(req.user.id));

        if (!alreadyRead) {
            memo.readBy.push({ employee: req.user.id, readAt: new Date() });
            await memo.save();
        }

        return res.json({
            message: "Memo marked as read.",
            memo
        });
    } catch (error) {
        console.error("Mark memo as read error:", error);
        return res.status(500).json({ message: "Unable to update memo status." });
    }
});

module.exports = router;
