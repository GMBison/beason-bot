import { DURATION_OPTIONS } from "@/lib/constants";
import { KeyType } from "@/lib/types";

export function startKeyboard({ approved, isAdmin }: { approved: boolean; isAdmin: boolean }) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  rows.push([{ text: "Request Access", callback_data: "request_access" }]);

  if (approved) {
    rows.push([
      { text: "Generate Temp Key", callback_data: "generate:temp" },
      { text: "Generate Standard Key", callback_data: "generate:standard" },
    ]);
    rows.push([
      { text: "My Generated Keys", callback_data: "my_keys" },
      { text: "Check Key Status", callback_data: "check_key" },
    ]);
  }

  if (isAdmin) {
    rows.push([{ text: "Admin Menu", callback_data: "admin_menu" }]);
  }

  return rows;
}

export function durationKeyboard(keyType: KeyType) {
  return DURATION_OPTIONS[keyType].map((option) => [
    {
      text: option.label,
      callback_data: `duration:${keyType}:${option.value}:${option.unit}`,
    },
  ]);
}

export function confirmKeyboard() {
  return [
    [
      { text: "Confirm", callback_data: "confirm_generation" },
      { text: "Cancel", callback_data: "cancel_flow" },
    ],
  ];
}

export function adminMenuKeyboard() {
  return [
    [{ text: "Pending Helpers", callback_data: "admin:pending" }],
    [
      { text: "Search Key", callback_data: "admin:search_key" },
      { text: "Search HWID", callback_data: "admin:search_hwid" },
    ],
    [
      { text: "Search Helper", callback_data: "admin:search_helper" },
      { text: "Helper Stats", callback_data: "admin:stats" },
    ],
  ];
}

export function helperApprovalKeyboard(helperId: string) {
  return [
    [
      { text: "Approve", callback_data: `admin:approve:${helperId}` },
      { text: "Reject", callback_data: `admin:reject:${helperId}` },
    ],
  ];
}

export function helperManagementKeyboard(helperId: string, isSuspended: boolean) {
  return [
    [
      {
        text: isSuspended ? "Reactivate Helper" : "Suspend Helper",
        callback_data: isSuspended ? `admin:reactivate:${helperId}` : `admin:suspend:${helperId}`,
      },
    ],
  ];
}

export function revokeKeyKeyboard(licenseId: string) {
  return [[{ text: "Revoke Key", callback_data: `admin:revoke:${licenseId}` }]];
}
