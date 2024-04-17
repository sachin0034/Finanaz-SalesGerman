const adminModel = require("../Model/Admin");
const callsModel = require("../Model/Calls");
const meetingModel = require("../Model/Meeting");
const emailModel = require("../Model/Emails");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const bcrypt = require("bcrypt");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const axios = require("axios");
const { OpenAIApi, Configuration, default: OpenAI } = require("openai");
const moment = require("moment");
const { sendErrorEmail } = require("../utils/Errormail");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const path = require("path");
const cron = require("node-cron");
const sgMail = require("@sendgrid/mail");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const fs = require("fs");
const process = require("process");

dotenv.config({ path: path.join(__dirname, "..", "api", ".env") });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const apiKey = process.env.BLAND_API_KEY;

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

const SCOPES = ["https://www.googleapis.com/auth/calendar"]
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

const schedule = "0 * * * *";

const job = cron.schedule(schedule, async () => {
  try {
    const options = { method: "GET", headers: { authorization: apiKey } };
    const oneHourAgo = moment().subtract(1, "hours").format();
    const response = await axios.get(`https://api.bland.ai/v1/calls`, options);
    const calls = response.data.calls;

    callIdsInLastHour = calls
      .filter((call) => {
        const callTime = moment(call.created_at);
        return callTime.isAfter(oneHourAgo);
      })
      .map((call) => call.c_id);

    console.log("Calls made in the last hour:");
    console.log(oneHourAgo, callIdsInLastHour);
  } catch (error) {
    sendErrorEmail("Error in fetching call logs");
  }

  try {
    for (let i = 0; i < callIdsInLastHour.length; i++) {
      const options = { method: "GET", headers: { authorization: apiKey } };
      const response = await axios.get(
        `https://api.bland.ai/v1/calls/${callIdsInLastHour[i]}`,
        options
      );
      if (response.status === 200) {
        const concatenatedTranscript = response.data.concatenated_transcript;
        let prompt = `From the below conversation extract the following details in json format only 1):email: user's email 2):meeting_requested: has user requested for meeting?  Boolean 3):meeting_time: Extract date and time. Convert it to Date() format  4):summary: Detailed summary of entire conversaton. The response should be strictly in json format with 4 attribute names exactly mentioned inside : : marks. If mentioned 4 atttributes aren't present in given conversation then don't mention the attribute${concatenatedTranscript}`;
        const GPTresponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: `${prompt}` }],
          max_tokens: 100,
        });
        console.log(GPTresponse.choices[0].message.content);
        jsonObject = JSON.parse(GPTresponse.choices[0].message.content);

        const callData = new callsModel({
          call_id: response.data.call_id,
          corrected_duration: response.data.corrected_duration,
          created_at: response.data.created_at,
          call_length: response.data.call_length,
          to: response.data.to,
          from: response.data.from,
          completed: response.data.completed,
          email: jsonObject.email ? jsonObject.email : null,
          meeting_requested: jsonObject.meeting_requested
            ? jsonObject.meeting_requested
            : null,
          meeting_time: jsonObject.meeting_time
            ? jsonObject.meeting_time
            : null,
        });
        await callData.save();
        if (jsonObject.email && jsonObject.email.length > 0) {
          const maildata = {
            to: jsonObject.email,
            from: "techavtar.tech@gmail.com",
            subject: "Thanks for contacting us",
            text: `Thanks for connecting with us.`,
          };
          sgMail
            .send(maildata)
            .then(async () => {
              const PromotionMail = new emailModel({
                email: jsonObject.email,
                time: response.data.created_at,
                subject: maildata.subject,
                body: maildata.text,
                to: response.data.to,
              });
              await PromotionMail.save();
            })
            .catch((error) => {
              console.error("Error sending email:", error);
            });
        }
        if (
          jsonObject.email &&
          validator.isEmail(jsonObject.email) &&
          jsonObject.email.length > 0 &&
          jsonObject.meeting_requested &&
          moment(jsonObject.meeting_time).isValid()
        ) {
          if (fs.existsSync(TOKEN_PATH)) {
            const content = await fs.promises.readFile(TOKEN_PATH, "utf8");
            const tokens = JSON.parse(content);

            const { client_id, client_secret, refresh_token } = tokens;
            const auth = new google.auth.OAuth2(client_id, client_secret);
            auth.setCredentials({ refresh_token });

            const calendar = google.calendar({ version: "v3", auth });
            const event = {
              summary: `meet with ${response.data.to}`,
              description: `${jsonObject.summary ? jsonObject.summary : ""}`,
              start: {
                dateTime: `${jsonObject.meeting_time}`,
                timeZone: "Asia/Kolkata",
              },
              end: {
                dateTime: moment(jsonObject.meeting_time)
                  .add(30, "minutes")
                  .format(),
                timeZone: "Asia/Kolkata",
              },

              reminders: {
                useDefault: false,
                overrides: [
                  { method: "email", minutes: 24 * 60 },
                  { method: "popup", minutes: 10 },
                ],
              },
              conferenceData: {
                createRequest: {
                  requestId: uuidv4(),
                  conferenceSolutionKey: { type: "hangoutsMeet" },
                },
              },
              attendees: [
                { email: "ganeshghatti6@gmail.com" },
                { email: jsonObject.email },
              ],
            };

            const calendarresponse = await calendar.events.insert({
              calendarId: "primary",
              resource: event,
              conferenceDataVersion: 1,
            });

            const meetLink = calendarresponse.data.hangoutLink;
            const meetingdata = new meetingModel({
              email: jsonObject.email,
              to: response.data.to,
              meeting_link: meetLink,
              summary: jsonObject.summary,
              meeting_time: jsonObject.meeting_time,
            });
            meetingdata.save();
            const msg = {
              to: jsonObject.email,
              from: "techavtar.tech@gmail.com",
              subject: "Invitation for meeting",
              text: `Thanks for connecting with us. Here is the link through which you can join the meet: ${meetLink}`,
            };
            sgMail
              .send(msg)
              .then(async () => {
                const MeetingMail = new emailModel({
                  email: jsonObject.email,
                  time: response.data.created_at,
                  subject: msg.subject,
                  body: msg.text,
                  to: response.data.to,
                });
                await MeetingMail.save();
              })
              .catch((error) => {
                console.error("Error sending email:", error);
              });
          } else {
            client = await authenticate({
              scopes: SCOPES,
              keyfilePath: CREDENTIALS_PATH,
            });
            fs.readFile(CREDENTIALS_PATH, "utf8", async (err, data) => {
              if (err) {
                console.error("Error reading file:", err);
              }
              try {
                const keys = JSON.parse(data);
                const key = keys.installed || keys.web;
                const payload = JSON.stringify({
                  type: "authorized_user",
                  client_id: key.client_id,
                  client_secret: key.client_secret,
                  refresh_token: client.credentials.refresh_token,
                });
                await fs.writeFile(TOKEN_PATH, payload, (err) => {
                  if (err) {
                    console.error("Error writing file:", err);
                  } else {
                    console.log("Token file created and updated.");
                  }
                });
              } catch (parseError) {
                console.error("Error parsing JSON:", parseError);
              }
            });
          }
        }
      } else {
        sendErrorEmail("Error in fetching transcript");
      }
    }
  } catch (error) {
    console.log("Internal Server Error:", error);
    sendErrorEmail("Internal Server Error");
  }

});

job.start();

exports.AdminLogin = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        error: "enter a valid email",
      });
    }
    const admin = await adminModel.findOne({ email: email });

    if (!admin) {
      return res.status(401).json({
        error: "wrong email or password",
      });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(400).json({
        error: "wrong email or password",
      });
    }

    const token = jwt.sign(
      { userId: admin._id, email: admin.email },
      process.env.ADMINJWTSECRET
    );

    res.status(200).json({
      email: admin.email,
      token: token,
    });
  } catch (error) {
    sendErrorEmail(email, "Someone tried to Login to Admin Panel");
    res.status(500).json({
      error: "Internal server error",
    });
  }
};

exports.GetAllVoices = async (req, res, next) => {
  res.status(200).json({
    voices: [
      {
        voice_id: "86812f09-28f0-4538-aa25-5d309e0e6e5d",
        name: "Male",
        is_custom: false,
        reduce_latency: true,
      },
      {
        voice_id: "13843c96-ab9e-4938-baf3-ad53fcee541d",
        name: "Female",
        is_custom: false,
        reduce_latency: true,
      },
    ],
  });
};

exports.SingleCall = async (req, res, next) => {
  const {
    phone_number,
    prompt,
    transfer_number,
    voice,
    from_number,
    max_duration,
  } = req.body;

  const { country_code: countryCode, actual_phone_number: phoneNumber } =
    phone_number;

  const {
    country_code: transferCountryCode,
    phone_number: transferPhoneNumber,
  } = transfer_number;

  const data = {
    phone_number: "+" + countryCode + phoneNumber,
    task: prompt,
    voice_id: 1,
    reduce_latency: false,
    transfer_phone_number: "+" + transferCountryCode + transferPhoneNumber,
  };

  axios
    .post("https://api.bland.ai/v1/calls", data, {
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
    })
    .then((response) => {
      const { status } = response.data;

      if (status) {
        res
          .status(200)
          .json({ message: "Phone call dispatched", status: "success" });
      }
    })
    .catch((error) => {
      console.log("Error:", error);
      res
        .status(400)
        .json({ message: "Error dispatching phone call", status: "error" });
    });
};

exports.BulkCall = async (req, res, next) => {
  try {
    const {
      prompt,
      transfer_number,
      voice,
      max_duration,
      phone_numbers,
      from_number,
    } = req.body;
    const {
      country_code: transferCountryCode,
      phone_number: transferPhoneNumber,
    } = transfer_number;

    if (!phone_numbers || phone_numbers.length === 0) {
      console.log("Phone numbers are missing");
      return res
        .status(400)
        .json({ message: "Phone numbers are missing", status: "error" });
    }

    const processedPhoneNumbers = new Set();

    const batches = [];
    for (let i = 0; i < phone_numbers.length; i += 10) {
      batches.push(phone_numbers.slice(i, i + 10));
    }

    for (const batch of batches) {
      console.log("Processing batch of phone numbers:", batch);
      const calls = batch
        .map((phoneNumber) => {
          if (processedPhoneNumbers.has(phoneNumber.actual_phone_number)) {
            console.log(
              "Phone number already processed:",
              phoneNumber.actual_phone_number
            );
            return null;
          }
          processedPhoneNumbers.add(phoneNumber.actual_phone_number);

          // Ensure the phone_number concatenation correctly includes the country code and actual phone number
          const fullPhoneNumber = phoneNumber.country_code + phoneNumber.actual_phone_number;
          console.log("Processing phone number:", fullPhoneNumber);

          return {
            phone_number: "+" + fullPhoneNumber, // Fixed concatenation here
            task: prompt,
            voice_id: voice,
            reduce_latency: false,
            transfer_phone_number: "+" + transferCountryCode + transferPhoneNumber, 
          };
        })
        .filter((call) => call !== null);

      console.log("Dispatching phone calls with data:", calls);
      await Promise.all(
        calls.map((call) => {
          return axios.post("https://api.bland.ai/v1/calls", call, {
            headers: {
              authorization: apiKey,
              "Content-Type": "application/json",
            },
          });
        })
      );
    }

    res
      .status(200)
      .json({ message: "Bulk calls dispatched", status: "success" });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(400)
      .json({ message: "Error dispatching bulk calls", status: "error" });
  }
};

exports.GetCallLogs = async (req, res) => {
  try {
    console.log("Fetching call logs with API Key:", apiKey);
    const options = { method: "GET", headers: { authorization: apiKey } };
    const response = await axios.get("https://api.bland.ai/v1/calls", options);

    console.log("Received response from API:", response.status);

    if (response.status === 200) {
      res.status(200).json(response.data);
    } else {
      res
        .status(response.status)
        .json({ message: "Failed to fetch call logs" });
    }
  } catch (error) {
    console.error("Error fetching call logs:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.GetTranscript = async (req, res) => {
  const { callId } = req.params;
  if (!callId) {
    return res.status(400).json({ message: "Call ID is missing" });
  }
  try {
    const options = { method: "GET", headers: { authorization: apiKey } };
    const response = await axios.get(
      `https://api.bland.ai/v1/calls/${callId}`,
      options
    );

    if (response.status === 200) {
      console.log(response.data);
      const transcripts = response.data.transcripts;
      if (transcripts && transcripts.length > 0) {
        const concatenatedTranscript = response.data.concatenated_transcript;
        console.log("Transcripts:");
        transcripts.forEach((transcript) => {
          console.log(transcript);
        });
        console.log("Concatenated Transcript:");
        console.log(concatenatedTranscript);
        return res.status(200).json({ transcripts, concatenatedTranscript });
      } else {
        console.log("Transcripts not found");
        return res.status(404).json({ message: "Transcripts not found" });
      }
    } else {
      console.error("Failed to fetch transcript");
      return res
        .status(response.status)
        .json({ message: "Failed to fetch transcript" });
    }
  } catch (error) {
    console.error("Error fetching transcript:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.GetSummary = async (req, res) => {
  console.log("Starting GetSummary function.");
  const { callId } = req.params;
  if (!callId) {
    console.log("Call ID is missing in the request.");
    return res.status(400).json({ message: "Call ID is missing" });
  }

  let concatenatedTranscript = "";

  try {
    console.log(`Fetching transcripts for call ID: ${callId}`);
    const options = { method: "GET", headers: { authorization: apiKey } };
    const response = await axios.get(
      `https://api.bland.ai/v1/calls/${callId}`,
      options
    );

    if (
      response.status === 200 &&
      response.data.transcripts &&
      response.data.transcripts.length > 0
    ) {
      concatenatedTranscript = response.data.concatenated_transcript;
      console.log("Successfully fetched and concatenated transcripts.");
    } else {
      console.log("Transcripts not found or empty.");
      return res.status(404).json({ message: "Transcripts not found" });
    }
  } catch (error) {
    console.error("Error fetching transcript:", error);
    return res.status(500).json({ message: "Internal server error++++++++" });
  }

  console.log("Generating summary with OpenAI.");
  const prompt = `Summarize this conversation:\n${concatenatedTranscript}`;

  try {
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `${prompt}` }],
      max_tokens: 100,
    });
    console.log("Summary generated succ.");
    console.log(summaryResponse);
    return res.status(200).json({ summaryResponse });
  } catch (error) {
    console.error("Error generating summary with OpenAI:", error);
    return res
      .status(500)
      .json({ message: "Internal server error++", error: error.message });
  }
};
exports.GetAllMeetings = async (req, res) => {
  try {
    const meetings = await meetingModel.find();
    res.status(200).json({ meetings });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.GetAllMails = async (req, res) => {
  try {
    const emails = await emailModel.find();
    res.status(200).json({ emails });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
