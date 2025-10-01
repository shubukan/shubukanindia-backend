require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db/connection");
const route = require("./router/route");

// require("./db/connection")

const app = express();

const allowedOrigins = [
  "http://localhost:3000",       // local dev
  "https://www.shubukanindia.org" // production frontend
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow server-to-server / curl
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Handle preflight requests globally
app.options("*", cors());

app.use(express.json());
app.use(route);
connectDB();

const PORT = process.env.PORT || 1234;

app.listen(PORT, () => {
  console.log(`Server Run on ${PORT} ...`);
});