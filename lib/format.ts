export function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function truncate(value: string, length = 18) {
  if (value.length <= length) return value;
  return `${value.slice(0, length)}...`;
}
