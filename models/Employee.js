const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({

    firstName: {
        type: String,
        required: true
    },

    lastName: {
        type: String,
        required: true
    },

    position: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    school: {
        type: String,
        required: true
    },

    discipline: {
        type: String,
        required: true
    },

    skill: {
        type: String,
        required: true
    },

    workDays: {
        type: [String],
        default: []
    },

    photoUrl: {
        type: String,
        default: ""
    },

    // Cloudinary's identifier for the uploaded photo -- needed so we can
    // properly delete the old photo from Cloudinary when it's replaced
    // or when the employee record itself is deleted
    photoPublicId: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});


module.exports = mongoose.model("Employee", employeeSchema);