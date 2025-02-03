require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db/connection");
const route = require("./router/route");

// require("./db/connection")

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://shubukanindia.org",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(route);
connectDB();

const PORT = process.env.PORT || 1234;

app.listen(PORT, () => {
  console.log(`Server Run on ${PORT} ...`);
});
