const express = require("express");
const router = express.Router();
const { AdminLogin, GetAllVoices, SingleCall, BulkCall, GetCallLogs, GetTranscript, GetSummary, ScheduleMeet, CalenderAuth, Calendar, CalendarAuth, CreateEvent, GetAllMeetings, GetAllMails} = require("../Controller/Admin");
const requireAuth = require("../middleware/Admin");

// Existing routes
router.route("/admin/login").post(AdminLogin);
router.route("/admin/get-all-voices").get(requireAuth, GetAllVoices);
router.route("/admin/single-call").post(requireAuth, SingleCall);
router.route("/admin/bulk-call").post(requireAuth, BulkCall);
router.route("/admin/call-logs").get(requireAuth, GetCallLogs);
router.route("/admin/get-transcript/:callId").get(requireAuth, GetTranscript);
router.route("/admin/get-summary/:callId").get(requireAuth, GetSummary);
router.route("/admin/get-meetings").get(requireAuth, GetAllMeetings);
router.route("/admin/get-emails").get(requireAuth, GetAllMails);

module.exports = router;
