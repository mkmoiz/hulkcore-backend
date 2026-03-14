import { toIsoString } from "../utils/dates.js";

export function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    phone: row.phone || "",
    fullName: row.fullName || "",
    email: row.email || "",
    addressLine1: row.addressLine1 || "",
    addressLine2: row.addressLine2 || "",
    city: row.city || "",
    state: row.state || "",
    postalCode: row.postalCode || "",
    country: row.country || "",
    isVerified: Boolean(row.isVerified),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function mapAuthSession(row) {
  if (!row) {
    return null;
  }

  return {
    token: row.token,
    userId: row.userId,
    expiresAt: toIsoString(row.expiresAt),
    createdAt: toIsoString(row.createdAt),
    user: row.userId
      ? {
          id: row.userId,
          phone: row.userPhone || "",
          fullName: row.userFullName || "",
          email: row.userEmail || "",
          addressLine1: row.userAddressLine1 || "",
          addressLine2: row.userAddressLine2 || "",
          city: row.userCity || "",
          state: row.userState || "",
          postalCode: row.userPostalCode || "",
          country: row.userCountry || "",
          isVerified: Boolean(row.userIsVerified),
          createdAt: toIsoString(row.userCreatedAt),
          updatedAt: toIsoString(row.userUpdatedAt),
        }
      : null,
  };
}
