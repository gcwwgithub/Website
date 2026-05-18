export function getColorProgressId(row) {
  if (!row || typeof row !== "object") {
    return "";
  }

  const rowNumber = String(row.__rowNumber || "").trim();
  const firstColumnWord = getFirstColumnWord(row);

  if (rowNumber && firstColumnWord) {
    return `row:${rowNumber}:${normalizeIdentityValue(firstColumnWord)}`;
  }

  const legacyValue = getLegacyIdentityValue(row);
  return legacyValue ? `row:${normalizeIdentityValue(legacyValue)}` : "";
}

export function getStrictColorProgressId(row) {
  if (!row || typeof row !== "object") {
    return "";
  }

  const rowNumber = String(row.__rowNumber || "").trim();
  const firstColumnWord = getFirstColumnWord(row);

  return rowNumber && firstColumnWord ? `row:${rowNumber}:${normalizeIdentityValue(firstColumnWord)}` : "";
}

export function getLegacyColorProgressId(row) {
  const legacyValue = getLegacyIdentityValue(row);
  return legacyValue ? `row:${normalizeIdentityValue(legacyValue)}` : "";
}

export function getFirstColumnWord(row) {
  return String(row.__firstColumnValue || getLegacyIdentityValue(row)).trim();
}

function getLegacyIdentityValue(row) {
  return (
    row["Chinese Words"] ||
    row["Chinese Word"] ||
    row._Chinese ||
    row.item ||
    row.sentence ||
    (Array.isArray(row.parts) ? row.parts.join("") : "") ||
    row.id ||
    ""
  );
}

function normalizeIdentityValue(value) {
  return String(value).trim().toLowerCase();
}
