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
    .select("username,password").eq("username", mamberData.username);
  if (error) {
    console.log("error", error);
    return error;
  }
  if (data.length === 0) {
    return "user not found";
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
    console.error("bcrypt.compare error:", err);
}


return checked;

}

// return true if the member credentials are valid else return false
app.post("/api/check/member/", apiKeyAuthMiddleware ,async (req, res) => {

  const data = {
    username: req.body.username,
    password: req.body.password,
  };

  const mamber = await checkMember(data);

  return res.json({mamber});
});



app.listen(process.env.SERVER_PORT, () => {
  console.log(`listening on port ${process.env.SERVER_PORT}`);
});
