const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const app = express();


// Allows Express to read JSON data from requests
app.use(express.json());

// Expose the reference sample portrait image so the browser can load it during validation.
app.get("/sample-face.jpeg", (req, res) => {
    res.sendFile(path.join(__dirname, "sample-face.jpeg"));
});

// Serves your HTML, CSS, images, etc. from the public folder.
// Uses an explicit absolute path (not a relative one) because relative
// paths can resolve incorrectly in Vercel's serverless environment.
app.use(express.static(path.join(__dirname, "public")));


// Import routes
const employeeRoutes = require("./routes/employees");
const authRoutes = require("./routes/auth");
const memoRoutes = require("./routes/memos");


// Connect routes
app.use("/api/employees", employeeRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/memos", memoRoutes);


// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log("MongoDB connected successfully");
})
.catch((error) => {
    console.log("MongoDB connection failed:");
    console.log(error);
});


// Test route
app.get("/test", (req, res) => {
    res.send("Server is working");
});


// Start server -- only when run directly (e.g. "node server.js" locally).
// On Vercel, the app is exported below and invoked as a function instead,
// so app.listen() never actually runs there.
if (require.main === module) {
    app.listen(5000, () => {
        console.log("Server running on port 5000");
    });
}


// Required for Vercel's @vercel/node builder to treat this as a
// serverless function it can invoke directly, instead of a
// long-running server process.
module.exports = app;