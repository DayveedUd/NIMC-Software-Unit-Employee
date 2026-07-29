const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


router.post("/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password are required."
            });
        }

        // Compare against the single admin account defined in .env
        if (username !== process.env.ADMIN_USERNAME) {
            return res.status(401).json({
                message: "Invalid username or password."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            process.env.ADMIN_PASSWORD_HASH
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid username or password."
            });
        }

        // Credentials check out -- issue a signed token valid for 8 hours
        const token = jwt.sign(
            { username: username },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        res.json({
            message: "Login successful",
            token: token
        });

    } catch (error) {

        console.error(error);
        res.status(500).json({
            message: "Something went wrong on our end. Please try again."
        });

    }

});


module.exports = router;