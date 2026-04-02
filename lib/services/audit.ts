import { supabaseAdmin } from "@/lib/supabase/server";
import { AuditLogPayload } from "@/lib/types";

export async function logAuditEvent(payload: AuditLogPayload) {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    actor_type: payload.actorType,
    actor_id: payload.actorId,
    action: payload.action,
    target_type: payload.targetType,
    target_id: payload.targetId,
    metadata_json: payload.metadata ?? {},
  });

  if (error) {
    throw new Error(`Failed to write audit log: ${error.message}`);
  }
}
