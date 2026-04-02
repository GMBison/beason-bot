import { KeyType } from "@/lib/types";

export const DURATION_OPTIONS: Record<
  KeyType,
  Array<{ value: number; unit: "hours" | "days" | "months" | "years"; label: string }>
> = {
  temp: [
    { value: 24, unit: "hours", label: "24 Hours" },
    { value: 3, unit: "days", label: "3 Days" },
    { value: 7, unit: "days", label: "7 Days" },
    { value: 14, unit: "days", label: "14 Days" },
  ],
  standard: [
    { value: 1, unit: "months", label: "1 Month" },
    { value: 3, unit: "months", label: "3 Months" },
    { value: 6, unit: "months", label: "6 Months" },
    { value: 12, unit: "months", label: "12 Months" },
  ],
};
