const mongoose = require("mongoose");

const memoSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null
    },
    senderName: {
        type: String,
        default: "Admin"
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null
    },
    type: {
        type: String,
        enum: ["DIRECT", "GENERAL"],
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    readBy: [{
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
}, {
    timestamps: true
});

module.exports = mongoose.model("Memo", memoSchema);
