export function getColorProgressId(row) {
  if (!row || typeof row !== "object") {
    return "";
  }

  return String(row.ID ?? row.id ?? "").trim();
}
