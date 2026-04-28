

export function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

export function parsePositiveInt(value, fallback) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return fallback;
  }

  return num;
}

export function normalizeCustomerCode(customerCode) {
  if (typeof customerCode !== "string") {
    return "default";
  }

  const normalized = customerCode.trim().toLowerCase();
  return normalized || "default";
}

export function normalizeCustomerRef(customerRef) {
  if (typeof customerRef !== "string") {
    return "";
  }

  return customerRef.trim();
}

export function normalizePhone(phone) {
  if (typeof phone !== "string") {
    return "";
  }

  return phone.trim();
}

export function normalizeEmail(email) {
  if (typeof email !== "string") {
    return "";
  }

  return email.trim().toLowerCase();
}

export function normalizeProductImageList(images, fallbackImageUrl = "", fallbackImageKey = "") {
  const normalized = Array.isArray(images)
    ? images
        .map((image, index) => {
          const imageUrl = normalizeText(image?.imageUrl);
          const imageKey = normalizeText(image?.imageKey);
          const sortOrderCandidate = Number(image?.sortOrder);
          const sortOrder =
            Number.isInteger(sortOrderCandidate) && sortOrderCandidate >= 0 ? sortOrderCandidate : index;

          if (!imageUrl) {
            return null;
          }

          return {
            imageUrl,
            imageKey,
            sortOrder,
          };
        })
        .filter(Boolean)
    : [];

  if (normalized.length > 0) {
    return normalized.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const fallbackUrl = normalizeText(fallbackImageUrl);
  if (!fallbackUrl) {
    return [];
  }

  return [
    {
      imageUrl: fallbackUrl,
      imageKey: normalizeText(fallbackImageKey),
      sortOrder: 0,
    },
  ];
}



export function normalizeIdArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeText(value))
    .filter(Boolean);
}
