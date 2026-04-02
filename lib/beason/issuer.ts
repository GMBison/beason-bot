import { env } from "@/lib/env";
import {
  IssueLicenseInput,
  IssueLicenseOutput,
  issueWithRemoteBeasonIssuer,
} from "@/lib/beason/http-issuer";

export interface BeasonIssuer {
  issue(input: IssueLicenseInput): Promise<IssueLicenseOutput>;
}

class RemoteBeasonIssuer implements BeasonIssuer {
  async issue(input: IssueLicenseInput) {
    return issueWithRemoteBeasonIssuer(input);
  }
}

export function getBeasonIssuer(): BeasonIssuer {
  switch (env.BEASON_ISSUER_MODE) {
    case "remote":
      return new RemoteBeasonIssuer();
    default:
      throw new Error("Unsupported BEASON issuer mode.");
  }
}

// Keep the BEASON signing boundary behind one function so the real issuer
// can be swapped in later without changing Telegram flows or dashboard logic.
export async function generateBeasonLicense(input: IssueLicenseInput): Promise<IssueLicenseOutput> {
  const issuer = getBeasonIssuer();
  return issuer.issue(input);
}
