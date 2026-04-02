export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";
export type HelperRole = "super_admin" | "admin" | "helper";
export type KeyType = "temp" | "standard";
export type LicenseStatus = "unused" | "active" | "expired" | "revoked";

export type Helper = {
  id: string;
  telegram_user_id: number;
  telegram_username: string | null;
  full_name: string;
  role: HelperRole;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LicenseKeyRecord = {
  id: string;
  key_code: string;
  signed_payload: Record<string, unknown>;
  product_code: string;
  key_type: KeyType;
  duration_value: number;
  duration_unit: "hours" | "days" | "months" | "years";
  hwid: string;
  generated_by_helper_id: string;
  generated_at: string;
  status: LicenseStatus;
  activated_at: string | null;
  expires_at: string;
  notes: string | null;
};

export type AuditLogPayload = {
  actorType: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
};
