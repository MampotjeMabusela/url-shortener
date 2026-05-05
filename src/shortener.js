const crypto = require("crypto");
const db = require("./db");

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SLUG_LEN = 6;
const MAX_RETRIES = 8;

function randomBase62(length) {
  const bytes = crypto.randomBytes(length);
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += BASE62[bytes[i] % BASE62.length];
  }
  return value;
}

function createUniqueSlug() {
  for (let i = 0; i < MAX_RETRIES; i += 1) {
    const slug = randomBase62(SLUG_LEN);
    const exists = db.prepare("SELECT 1 FROM links WHERE slug = ?").get(slug);
    if (!exists) return slug;
  }
  throw new Error("Could not generate a unique slug after several retries");
}

function shorten(longUrl) {
  const existing = db.prepare("SELECT slug FROM links WHERE long_url = ?").get(longUrl);
  if (existing) return existing.slug;

  for (let i = 0; i < MAX_RETRIES; i += 1) {
    const slug = createUniqueSlug();
    try {
      db.prepare("INSERT INTO links (slug, long_url) VALUES (?, ?)").run(slug, longUrl);
      return slug;
    } catch (error) {
      // Handles concurrent inserts for same URL and rare slug collisions.
      const isConstraint = String(error.message || "").includes("UNIQUE constraint failed");
      if (!isConstraint) throw error;

      const nowExisting = db.prepare("SELECT slug FROM links WHERE long_url = ?").get(longUrl);
      if (nowExisting) return nowExisting.slug;
    }
  }

  throw new Error("Could not shorten URL due to repeated collisions");
}

function getLink(slug) {
  return db.prepare("SELECT * FROM links WHERE slug = ?").get(slug);
}

function incrementClicks(slug) {
  db.prepare("UPDATE links SET clicks = clicks + 1 WHERE slug = ?").run(slug);
}

function listLinks() {
  return db.prepare("SELECT * FROM links ORDER BY created_at DESC").all();
}

module.exports = {
  shorten,
  getLink,
  incrementClicks,
  listLinks,
};
