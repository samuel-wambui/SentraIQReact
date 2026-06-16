export interface UserDisplayFields {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  displayName?: string | null;
}

const clean = (value?: string | null) => {
  const trimmed = String(value ?? "").trim();
  return trimmed || "";
};

export const fullNameFromParts = (source?: UserDisplayFields | null) => {
  if (!source) return "";
  const explicit = clean(source.fullName);
  if (explicit) return explicit;
  return [source.firstName, source.lastName].map(clean).filter(Boolean).join(" ");
};

export const userDisplayName = (
  username?: string | null,
  fullName?: string | null,
  displayName?: string | null
) => {
  const resolvedDisplay = clean(displayName);
  if (resolvedDisplay) return resolvedDisplay;

  const resolvedUsername = clean(username);
  const resolvedFullName = clean(fullName);
  if (resolvedUsername && resolvedFullName) return `${resolvedUsername} - ${resolvedFullName}`;
  return resolvedUsername || resolvedFullName || "-";
};

