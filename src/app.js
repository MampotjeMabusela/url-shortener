require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const basicAuth = require("./auth");
const { shorten, getLink, incrementClicks, listLinks } = require("./shortener");

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDomain = process.env.PUBLIC_DOMAIN || "localhost";

app.set("trust proxy", true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("src/public"));
app.set("view engine", "ejs");
app.set("views", "./src/views");
app.use(morgan(":date[iso] :method :url :status :response-time ms ip=:remote-addr"));

app.get("/healthz", (req, res) => {
  res.status(200).send("ok");
});

const shortenLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

function validateUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    return "Invalid URL";
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return "Only http and https URLs are allowed";
  }

  const normalizedDomain = publicDomain.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
  if (normalizedDomain && parsed.hostname.toLowerCase() === normalizedDomain) {
    return "Cannot shorten URLs from this domain";
  }

  return null;
}

app.get("/", basicAuth, (req, res) => {
  const links = listLinks();
  res.render("dashboard", { links, publicDomain });
});

app.post("/api/shorten", basicAuth, shortenLimiter, (req, res) => {
  const longUrl = req.body.long_url;
  if (!longUrl) {
    return res.status(400).json({ error: "long_url is required" });
  }

  const validationError = validateUrl(longUrl);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const slug = shorten(longUrl);
    const shortUrl = `https://${publicDomain}/${slug}`;
    return res.json({ slug, short_url: shortUrl });
  } catch (error) {
    console.error("Shortening failed:", error);
    return res.status(500).json({ error: "Failed to shorten URL" });
  }
});

app.get("/api/stats/:slug", (req, res) => {
  const link = getLink(req.params.slug);
  if (!link) return res.status(404).json({ error: "Slug not found" });
  return res.json({
    slug: link.slug,
    long_url: link.long_url,
    clicks: link.clicks,
    created_at: link.created_at,
  });
});

app.get("/:slug", (req, res) => {
  const link = getLink(req.params.slug);
  if (!link) return res.status(404).send("Not found");

  incrementClicks(link.slug);
  console.log(`${new Date().toISOString()} redirect slug=${link.slug} ip=${req.ip}`);
  return res.redirect(302, link.long_url);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
