require("dotenv").config();
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const supabaseConnect = require("@supabase/supabase-js");
// import { createClient } from '@supabase/supabase-js'
// const serverless = require('serverless-http');

const express = require("express");
const app = express();

app.use(express.json());

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

const supabase = supabaseConnect.createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const apiKeyAuthMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key']; 
  
    if (apiKey && apiKey === process.env.JICCOT_API_KEY) {
      // Valid API key, allow the request to proceed
      next();
    } else {
      // Invalid or missing API key, return an error response
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

async function checkMember(mamberData) {

    const { data, error } = await supabase
    .from("members")
    .select("username,password,role").eq("username", mamberData.username);
  if (error) {
    console.log("error", error);
    return error;
  }
  if (data.length === 0) {
    return "User not found";
  }

var checked = false;
try {
    const result = await new Promise((resolve, reject) => {
        bcrypt.compare(mamberData.password, data[0].password, (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });

    checked = result;
} catch (err) {
    console.error("bcrypt error:", err);
}

if(checked){
  return { username : data[0].username, role : data[0].role }
}
  return "wrong password"
}

app.post("/api/check/member/", apiKeyAuthMiddleware ,async (req, res) => {

  const data = {
    username: req.body.username,
    password: req.body.password,
  };

  const info = await checkMember(data);

  return res.json({info});
});



async function CreateEvent(eventData) {

  const { data, error } = await supabase.from("events").insert({
   EventType : eventData.type,
   EventTitle : eventData.title,
   EventDetails : eventData.details,
   Presenter : eventData.presenter,
   Location : eventData.location,
   StartDate : eventData.startDate,
   EndDate : eventData.endDate,
  });

  if (error) {
  console.log("[ req error ] :", error)
  if (error.message.includes("key")) {
      // Handle the case where the email already exists
      return({ error: "Event already exists" });
    } else {
      console.error("Error inserting data:", error.message);
      return({ error: "Internal Server Error" });
    }
  }

  return ({success: true});
}




app.post("/api/create/event/", apiKeyAuthMiddleware ,async (req, res) => {
  
  const data = {
    title: req.body.title,
    type: req.body.type,
    details: req.body.details,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    location: req.body.location,
    presenter: req.body.presenter
  };

  const info = await CreateEvent(data)

  return res.json({info});

});

app.listen(process.env.SERVER_PORT, () => {
  console.log(`listening on port ${process.env.SERVER_PORT}`);
});
