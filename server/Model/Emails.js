const mongoose = require("mongoose");

const emailSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  to: {
    type: String,
  },
});

const Email = mongoose.model("Email", emailSchema);

module.exports = Email;
