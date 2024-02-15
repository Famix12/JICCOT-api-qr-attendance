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

async function memberLogin(mamberData) {

    const { data, error } = await supabase
    .from("members")
    .select("id,FName,LName,username,password,role").eq("username", mamberData.username);
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
  return {
      mamberID : data[0].id,
      FName : data[0].FName,
      LName : data[0].LName,
      username : data[0].username,
      role : data[0].role
    }
  
}
  return "wrong password"
}

app.post("/api/login/member/", apiKeyAuthMiddleware ,async (req, res) => {

  const data = {
    username: req.body.username,
    password: req.body.password,
  };

  const info = await memberLogin(data);

  return res.json({info});
});

// async function checkPresenter(PresenterUsername){
//   const { data, error } = await supabase
//   .from("members")
//   .select("username").eq("username", PresenterUsername);
// console.log("checkPresenter",data);
// if (error) {
//   console.log("error", error);
//   return({"error" : error, "exist" : false});
// }
// return({"exist" : true});
// }

async function checkPresenter(PresenterUsername) {
  const { data, error } = await supabase
    .from("members")
    .select("FName, LName")
    .eq("username", PresenterUsername);

  if (error) {
    console.log("error", error);
    return { msg: error, exist: false };
  }

  if (data && data.length > 0) {
    const { FName, LName } = data[0];
    return { exist: true, FName, LName };
  } else {
    return { exist: false, msg: "Presenter not exist" };
  }
}


async function CreateEvent(eventData) {

  const { data, error } = await supabase.from("events").insert({
   EventType : eventData.type,
   EventTitle : eventData.title,
   EventDetails : eventData.details,
   Presenter : eventData.presenter,
   Location : eventData.location,
   StartDate : eventData.startDate,
   EndDate : eventData.endDate,
  }).select();

  if (error) {
  console.log("[ req error ] :", error)
  if (error.message.includes("key")) {
      // Handle the case where the email already exists
      return({ error: "Event Title already exists" });
    } else {
      console.error("Error inserting data:", error.message);
      return({ error: "Internal Server Error" });
    }
  }

  // console.log(data)
  return ({success: true, EventID : data[0].EventID});
}

app.post("/api/create/event/", apiKeyAuthMiddleware ,async (req, res) => {
  
  // console.log(req.body.presenter)
  const checkPresenterEx = await checkPresenter(req.body.presenter)
  // console.log("checkPresenterEx.FName", checkPresenterEx.FName)

  if(checkPresenterEx.exist){
    const data = {
      title: req.body.title,
      type: req.body.type,
      details: req.body.details,
      // date format : 2024-02-10 00:00:00+00
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      location: req.body.location,
      presenter: req.body.presenter
    };
  
    const info = await CreateEvent(data)
    return res.json({info});
  }
  return res.json({info : checkPresenterEx.msg})

});


app.post("/api/remove/event/",apiKeyAuthMiddleware, async (req, res) => {

});

app.get("/api/list/event/",apiKeyAuthMiddleware, async (req, res) => {
    const {data, error} = await supabase.from("events").select("EventID,EventTitle,EventType")
    if(error){
      return res.json({info : error})
    }
    return res.json({Events : data})
});

app.post("/api/enrollTo/event/", apiKeyAuthMiddleware, async (req, res) => {

  if (!req.body.EventID || !req.body.MemberID ){
    console.log(req.body)
    return res.json({ success: false, info: "Invalid data provided" });
}

try {
  // Insert enrollment data into the database
  const { data, error } = await supabase.from("attendance").insert({
      EventID: req.body.EventID,
      MemberID: req.body.MemberID
  });

  // Check for duplicate key error
  if (error && error.message.includes("duplicate")) {
      console.error(error);
      return res.json({ success: false, info: "Already Enrolled" });
  }

  // Handle other errors
  if (error) {
      console.error(error);
      return res.json({ success: false, info: "An error occurred while enrolling" });
  }

  // Enrollment successful
  return res.json({ success: true ,info : "Enrolled successfully" });
} catch (error) {
  console.error(error);
  return res.status(500).json({ success: false, info: "Internal server error" });
}
});

app.post("/api/attened/present/", apiKeyAuthMiddleware, async (req, res)=> {
  if (!req.body.EventID || !req.body.MemberID ){
    console.log(req.body)
    return res.json({ success: false, info: "Invalid data provided" });
  }

  const { error } = await supabase.from("attendance").update({'attended' : true}).eq("EventID",req.body.EventID).eq("EventID",req.body.EventID)
  if(error){
    // console.log(error)
    return res.json({ status : false ,info : "Memeber already attended", error : error})
  }
  return res.json({ status : true, info : "Attended successfully"})

});

app.post("/api/attened/absent/", apiKeyAuthMiddleware, async (req, res)=> {
  if (!req.body.EventID || !req.body.MemberID ){
    console.log(req.body)
    return res.json({ success: false, info: "Invalid data provided" });
  }

  const { error } = await supabase.from("attendance").update({'attended' : false}).eq("EventID",req.body.EventID).eq("EventID",req.body.EventID)
  if(error){
    // console.log(error)
    return res.json({ status : false ,info : "Memeber already absent", error : error})
  }
  return res.json({ status : true, info : "Member marked absent successfully"})

});

// app.get("/api/list/event/members/", apiKeyAuthMiddleware, async (req, res) => {

//   if (!req.body.EventID) {
//     return res.json({ success: false, info: "EventID is required" });
//   }

//   try {
//     // Retrieve list of members attending the specified event
//     // const { data, error } = await supabase
//     //   .from("attendance")
//     //   .select("MemberID, attended")
//     //   .eq("EventID", req.body.EventID);
//     const { data, error } = await supabase
//       .from("attendance")
//       .select("attendance.MemberID, attendance.attended, members.id, members.username, members.FName, members.LName")
//       .eq("EventID", req.query.EventID)
//       .eq("attendance.MemberID", "members.id")

//     if (error) {
//       console.error(error);
//       return res.json({ success: false, info: "An error occurred while fetching event members" });
//     }

//     return res.json({ success: true, data });
//   } catch (error) {
//     console.error(error);
//     return res.json({ success: false, info: "Internal server error" });
//   }
// });


// API endpoint for retrieving list of event members with additional details from the "members" table
app.get("/api/list/event/members/", apiKeyAuthMiddleware, async (req, res) => {
  // Check if EventID is provided
  if (!req.body.EventID) {
    return res.status(400).json({ success: false, info: "EventID is required" });
  }

  try {
    // Retrieve list of members attending the specified event from the "attendance" table
    const { data: attendanceData, error: attendanceError } = await supabase
      .from("attendance")
      .select("MemberID, attended")
      .eq("EventID", req.body.EventID);

    if (attendanceError) {
      console.error(attendanceError);
      return res.status(500).json({ success: false, info: "An error occurred while fetching event members" });
    }

    // Extract MemberIDs from the attendance data
    const memberIDs = attendanceData.map(entry => entry.MemberID);

    // Retrieve member details (username, FName, LName) based on the extracted MemberIDs from the "members" table
    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("id, username, FName, LName")
      .in("id", memberIDs);

    if (memberError) {
      console.error(memberError);
      return res.status(500).json({ success: false, info: "An error occurred while fetching member details" });
    }

    // Combine attendance data with member details
    const eventMembers = attendanceData.map(attendanceEntry => {
      const memberDetail = memberData.find(memberEntry => memberEntry.id === attendanceEntry.MemberID);
      return {
        MemberID: attendanceEntry.MemberID,
        attended: attendanceEntry.attended,
        username: memberDetail ? memberDetail.username : null,
        FName: memberDetail ? memberDetail.FName : null,
        LName: memberDetail ? memberDetail.LName : null
      };
    });

    // Send the list of event members with details
    return res.json({ success: true, data: eventMembers });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, info: "Internal server error" });
  }
});

app.listen(process.env.SERVER_PORT, () => {
  console.log(`listening on port ${process.env.SERVER_PORT}`);
});
