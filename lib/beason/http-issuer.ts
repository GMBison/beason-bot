import { add } from "date-fns";
import { env } from "@/lib/env";
import { KeyType } from "@/lib/types";

export type IssueLicenseInput = {
  productCode: string;
  keyType: KeyType;
  durationValue: number;
  durationUnit: "hours" | "days" | "months" | "years";
  hwid: string;
  generatedBy: {
    helperId: string;
    telegramUserId: number;
    name: string;
  };
};

export type IssueLicenseOutput = {
  keyCode: string;
  signedPayload: Record<string, unknown>;
  expiresAt: string;
};

export async function issueWithRemoteBeasonIssuer(
  input: IssueLicenseInput,
): Promise<IssueLicenseOutput> {
  const response = await fetch(env.BEASON_ISSUER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.BEASON_ISSUER_API_KEY}`,
    },
    body: JSON.stringify({
      product_code: input.productCode,
      key_type: input.keyType,
      duration_value: input.durationValue,
      duration_unit: input.durationUnit,
      hwid: input.hwid,
      generated_by: {
        helper_id: input.generatedBy.helperId,
        telegram_user_id: input.generatedBy.telegramUserId,
        name: input.generatedBy.name,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`BEASON issuer rejected request: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as Partial<IssueLicenseOutput>;
  if (!data.keyCode || !data.signedPayload || !data.expiresAt) {
    throw new Error("BEASON issuer returned an incomplete payload.");
  }

  return {
    keyCode: data.keyCode,
    signedPayload: data.signedPayload,
    expiresAt: data.expiresAt,
  };
}

export function computeFallbackExpiry(
  durationValue: number,
  durationUnit: "hours" | "days" | "months" | "years",
) {
  return add(new Date(), { [durationUnit]: durationValue }).toISOString();
}
