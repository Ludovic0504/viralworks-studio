import { afterEach, describe, expect, it } from "vitest";
import {
  normalizeAllowedProductionOrigin,
  resolveCheckoutReturnOrigin,
  PRODUCTION_CANONICAL_ORIGIN,
} from "./site-origin.ts";

describe("site-origin", () => {
  const prevSiteUrl = process.env.SITE_URL;

  afterEach(() => {
    if (prevSiteUrl === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = prevSiteUrl;
  });

  it("rejette Netlify", () => {
    expect(
      normalizeAllowedProductionOrigin("https://resonant-lollipop-9ca6ba.netlify.app"),
    ).toBeNull();
  });

  it("normalise apex et www vers le canonique", () => {
    expect(normalizeAllowedProductionOrigin("https://viralworks-studio.com")).toBe(
      PRODUCTION_CANONICAL_ORIGIN,
    );
    expect(normalizeAllowedProductionOrigin("https://www.viralworks-studio.com")).toBe(
      PRODUCTION_CANONICAL_ORIGIN,
    );
  });

  it("force viralworks-studio.com en prod même si SITE_URL est Netlify", () => {
    process.env.SITE_URL = "https://resonant-lollipop-9ca6ba.netlify.app";
    expect(resolveCheckoutReturnOrigin("https://viralworks-studio.com")).toBe(
      PRODUCTION_CANONICAL_ORIGIN,
    );
  });

  it("autorise localhost en dev", () => {
    delete process.env.SITE_URL;
    expect(resolveCheckoutReturnOrigin("http://localhost:5173")).toBe(
      "http://localhost:5173",
    );
  });
});
