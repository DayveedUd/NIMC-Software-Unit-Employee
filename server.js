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


// Start server
app.listen(5000, () => {
    console.log("Server running on port 5000");
});