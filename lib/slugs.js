export function normalizeSlug(input) {
  if (!input) {
    return "";
  }

  return input
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function createSlug(input, fallback = "") {
  const slug = normalizeSlug(input);
  return slug || fallback;
}

export function withNumericSlugSuffix(slug, index) {
  if (index <= 1) {
    return slug;
  }

  const suffix = `-${index}`;
  const base = slug.slice(0, 80 - suffix.length);
  return base + suffix;
}
