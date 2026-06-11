import { describe, it, expect } from "vitest";
import { jwtTenantClaim, tenantClaimIsStale } from "@/lib/auth/claimsSync";

function token(payload: object) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
}

describe("jwtTenantClaim", () => {
  it("extracts the tenant_id claim from a JWT payload", () => {
    expect(jwtTenantClaim(token({ app_metadata: { tenant_id: "w-1" } }))).toBe(
      "w-1"
    );
  });

  it("returns null when the claim is absent or empty", () => {
    expect(jwtTenantClaim(token({ app_metadata: {} }))).toBeNull();
    expect(jwtTenantClaim(token({ app_metadata: { tenant_id: "" } }))).toBeNull();
    expect(jwtTenantClaim(token({}))).toBeNull();
  });

  it("returns null for a non-string claim", () => {
    expect(jwtTenantClaim(token({ app_metadata: { tenant_id: 42 } }))).toBeNull();
  });

  it("never throws on missing or malformed tokens", () => {
    expect(jwtTenantClaim(null)).toBeNull();
    expect(jwtTenantClaim(undefined)).toBeNull();
    expect(jwtTenantClaim("")).toBeNull();
    expect(jwtTenantClaim("not-a-jwt")).toBeNull();
    expect(jwtTenantClaim("only.two")).toBeNull();
    expect(jwtTenantClaim("a.%%%not-base64%%%.c")).toBeNull();
    expect(
      jwtTenantClaim(`a.${Buffer.from("not json").toString("base64url")}.c`)
    ).toBeNull();
  });
});

describe("tenantClaimIsStale", () => {
  const withWave = token({ app_metadata: { tenant_id: "w-1" } });
  const withoutWave = token({ app_metadata: {} });

  it("is fresh when token claim and record agree", () => {
    expect(tenantClaimIsStale(withWave, "w-1")).toBe(false);
  });

  it("is stale when the record moved to another wave (reassign)", () => {
    expect(tenantClaimIsStale(withWave, "w-2")).toBe(true);
  });

  it("is stale when the record gained a wave the token doesn't carry", () => {
    expect(tenantClaimIsStale(withoutWave, "w-1")).toBe(true);
  });

  it("is stale when the record lost its wave but the token still carries one", () => {
    expect(tenantClaimIsStale(withWave, null)).toBe(true);
    expect(tenantClaimIsStale(withWave, undefined)).toBe(true);
    expect(tenantClaimIsStale(withWave, "")).toBe(true);
  });

  it("is fresh when neither side has a wave (nothing to sync)", () => {
    expect(tenantClaimIsStale(withoutWave, undefined)).toBe(false);
    expect(tenantClaimIsStale(withoutWave, null)).toBe(false);
  });

  it("treats a non-string record value as no wave", () => {
    expect(tenantClaimIsStale(withoutWave, 123)).toBe(false);
    expect(tenantClaimIsStale(withWave, 123)).toBe(true);
  });
});
