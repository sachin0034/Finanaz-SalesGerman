const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  to:{
    type:String,
    require:true,
  },
  meeting_time: {
    type: Date,
    required: true,
  },
  summary: {
    type: String,
  },
  meeting_link: {
    type: String,
    required: true,
  },
});

const Meeting = mongoose.model("Meeting", meetingSchema);

module.exports = Meeting;
