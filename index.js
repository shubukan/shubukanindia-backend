require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db/connection");
const route = require("./router/route");

const app = express();

const allowedOrigins = ["http://localhost:3000", "https://shubukanindia.org", "https://www.shubukanindia.org"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // ✅ allow cookies
  })
);

app.use(express.json());
app.use(route);

connectDB();

const PORT = process.env.PORT || 1234;

app.listen(PORT, () => {
  console.log(`Server Run on ${PORT} ...`);
});
