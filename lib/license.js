"use strict";

const crypto = require("crypto");
const { getConfig } = require("./config");

function b64urlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecodeToUtf8(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest();
}

function normalizeHwid(rawValue) {
  const value = String(rawValue || "").trim().replace(/\s+/g, "");
  if (!value) {
    throw new Error("HWID is required.");
  }
  if (!/^[A-Fa-f0-9]{32,128}$/.test(value)) {
    throw new Error("Invalid HWID format. Paste the full BEASON HWID.");
  }
  return value.toUpperCase();
}

function createLicensePayload({ hwid, kind, expiresUnix }) {
  const config = getConfig();
  const normalizedHwid = normalizeHwid(hwid);
  const nowUnix = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(expiresUnix) || expiresUnix <= nowUnix) {
    throw new Error("Expiry must be in the future.");
  }

  return {
    v: 2,
    p: config.license.productId,
    pc: config.license.productCode,
    h: b64urlEncode(sha256Buffer(normalizedHwid)),
    n: nowUnix,
    nb: nowUnix,
    e: expiresUnix,
    k: String(kind || config.license.kind || "standard").trim().toLowerCase() === "temporary" ? "temporary" : "standard",
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
  };
}

function signLicensePayload({ payload, hwid }) {
  const config = getConfig();
  const normalizedHwid = normalizeHwid(hwid);
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = b64urlEncode(Buffer.from(payloadJson, "utf8"));
  const message = Buffer.from(`${payloadB64}.${normalizedHwid}`, "utf8");
  const signature = crypto.sign(null, message, config.license.privateKeyPem);

  return {
    payloadB64,
    signatureB64: b64urlEncode(signature),
    licenseKey: `${payloadB64}.${b64urlEncode(signature)}`,
  };
}

function generateLicenseKey({ hwid, kind, durationDays }) {
  const config = getConfig();
  const days = Number.isFinite(Number(durationDays)) ? Number(durationDays) : config.license.durationDays;
  const expiresUnix = Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
  const payload = createLicensePayload({
    hwid,
    kind: kind || config.license.kind,
    expiresUnix,
  });
  const signed = signLicensePayload({ payload, hwid });
  return {
    hwid: normalizeHwid(hwid),
    payload,
    expiresUnix,
    licenseKey: signed.licenseKey,
  };
}

function decodeLicensePayload(licenseKey) {
  const normalized = String(licenseKey || "").trim();
  const [payloadB64] = normalized.split(".");
  if (!payloadB64) return null;
  return JSON.parse(b64urlDecodeToUtf8(payloadB64));
}

module.exports = {
  normalizeHwid,
  generateLicenseKey,
  decodeLicensePayload,
};
