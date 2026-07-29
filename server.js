const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();


// Allows Express to read JSON data from requests
app.use(express.json());


// Serves your HTML, CSS, images, etc. from the public folder
app.use(express.static("public"));


// Import routes
const employeeRoutes = require("./routes/employees");
const authRoutes = require("./routes/auth");


// Connect routes
app.use("/api/employees", employeeRoutes);
app.use("/api/auth", authRoutes);


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