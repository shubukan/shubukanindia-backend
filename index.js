require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db/connection");
const route = require("./router/route");

// require("./db/connection")

const app = express();
app.options("*", cors());
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:5173",
        "https://shubukanindia.org",
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS Not Allowed"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());
app.use(route);
connectDB();

app.use((req, res, next) => {
  console.log("Incoming Request Headers:", req.headers);
  console.log("Origin:", req.get("origin"));
  next();
});

const PORT = process.env.PORT || 1234;

app.listen(PORT, () => {
  console.log(`Server Run on ${PORT} ...`);
});
