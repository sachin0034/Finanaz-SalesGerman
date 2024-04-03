const axios = require("axios");
const moment = require("moment");
const nodemailer = require("nodemailer");
const express = require("express");
const emailModel = require("../Model/Emails");

const sgMail = require("@sendgrid/mail");

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
sgMail.setApiKey(SENDGRID_API_KEY);

const sendErrorEmail = async (action) => {
  try {
    const msg = {
      to: "ganeshghatti6@gmail.com",
      from: "techavtar.tech@gmail.com",
      subject: "Error Alert!!",
      text: action,
    };
    sgMail
      .send(msg)
      .then(async () => {
        const Errormail = new emailModel({
          email: msg.to,
          time: moment().format('MMMM Do YYYY, h:mm:ss a'),
          subject: msg.subject,
          body: msg.text,
        });
        await Errormail.save();
      })
      .catch((error) => {
        console.error("Error sending email:", error);
      });
    return true;
  } catch (error) {
    console.error("Error sending error email:", error.message);
    return false;
  }
};

module.exports = { sendErrorEmail };
