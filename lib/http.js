"use strict";

async function readRawBody(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(req) {
  const raw = await readRawBody(req);
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res, methods) {
  res.setHeader("Allow", methods.join(", "));
  sendJson(res, 405, { ok: false, error: "Method not allowed." });
}

module.exports = {
  readRawBody,
  readJsonBody,
  sendJson,
  methodNotAllowed,
};
