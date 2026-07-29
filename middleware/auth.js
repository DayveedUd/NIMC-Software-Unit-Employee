const jwt = require("jsonwebtoken");

// Checks for a valid "Authorization: Bearer <token>" header.
// If missing or invalid, the request is rejected before it ever
// reaches the actual route handler (e.g. viewing/editing employees).
function verifyToken(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "You must be logged in to do that."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = decoded; // available to any route that needs it later
        next();

    } catch (error) {
        return res.status(401).json({
            message: "Your session has expired. Please log in again."
        });
    }

}

module.exports = verifyToken;