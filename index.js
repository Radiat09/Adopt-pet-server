const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 9000;

// Middlewares
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Adopt Pet is running");
});

app.listen(port, () => {
  console.log("Adopt Pet server is running on port: ", port);
});
