const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Access denied. Token missing." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Exposes { role, id, username } on req.user
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token." });
    }
}

module.exports = verifyToken;