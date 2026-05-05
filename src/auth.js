const auth = require("basic-auth");

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "letmein";

function basicAuth(req, res, next) {
  const user = auth(req);
  if (!user || user.name !== ADMIN_USER || user.pass !== ADMIN_PASS) {
    res.set("WWW-Authenticate", 'Basic realm="Shortener Admin"');
    return res.status(401).send("Access denied");
  }
  return next();
}

module.exports = basicAuth;
