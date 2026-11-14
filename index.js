require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db/connection");
const route = require("./router/route");
const dns = require("node:dns");

// require("./db/connection")

const app = express();
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const allowedOrigins = [
  "http://localhost:3000", // local dev (Next.js default)
  "https://www.shubukanindia.org", // production frontend
  "https://shubukanindia.vercel.app", // test exam app
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow server-to-server / curl
      // Allow any localhost port during local dev, since it changes between setups
      if (allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-email",
      "x-email-token",
    ],
  }),
);

// Handle preflight requests globally
// app.options("*", cors());
// deprecated in latest express

app.use(express.json());

// Make sure the DB is connected before any route runs (reuses the cached
// connection on warm instances; answers 503 instead of hanging if Mongo is down).
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(503).json({ message: "Database unavailable, please try again." });
  }
});

app.use(route);
connectDB().catch(() => {}); // warm up the connection at cold start

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server Run on ${PORT} ...`);
});
