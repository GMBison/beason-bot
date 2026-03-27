"use strict";

const { createClient } = require("@supabase/supabase-js");
const { getConfig } = require("./config");

let cachedClient = null;

function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;
  const config = getConfig();
  cachedClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cachedClient;
}

function unwrapSingle(result, missingMessage) {
  if (result.error) throw result.error;
  if (!result.data) {
    throw new Error(missingMessage || "Supabase record not found.");
  }
  return result.data;
}

module.exports = {
  getSupabaseAdmin,
  unwrapSingle,
};
