const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Employee = require("../models/Employee"); // Import Employee model

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Basic validation
    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required."
      });
    }

    // 2. CHECK ADMIN LOGIN (Matches .env credentials)
    if (username === process.env.ADMIN_USERNAME) {
      const passwordMatches = await bcrypt.compare(
        password,
        process.env.ADMIN_PASSWORD_HASH
      );

      if (!passwordMatches) {
        return res.status(401).json({
          message: "Invalid username or password."
        });
      }

      const token = jwt.sign(
        { username: username, role: "admin" },
        process.env.JWT_SECRET || "your_secret_key",
        { expiresIn: "8h" }
      );

      return res.json({
        message: "Login successful",
        role: "admin",
        token: token
      });
    }

    // 3. CHECK EMPLOYEE LOGIN (Matches MongoDB Employee records)
    const employee = await Employee.findOne({ username });
    if (!employee) {
      return res.status(401).json({
        message: "Invalid username or password."
      });
    }

    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid username or password."
      });
    }

    const token = jwt.sign(
      { id: employee._id, username: employee.username, role: "employee" },
      process.env.JWT_SECRET || "your_secret_key",
      { expiresIn: "8h" }
    );

    return res.json({
      message: "Login successful",
      role: "employee",
      employeeId: employee._id,
      token: token
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Something went wrong on our end. Please try again."
    });
  }
});

module.exports = router;