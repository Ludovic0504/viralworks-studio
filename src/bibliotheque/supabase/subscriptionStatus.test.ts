import { describe, expect, it } from "vitest";
import {
  ENTITLED_SUBSCRIPTION_STATUSES,
  isEntitledSubscriptionStatus,
} from "./subscriptionStatus";

describe("subscriptionStatus", () => {
  it("inclut active et trialing", () => {
    expect(ENTITLED_SUBSCRIPTION_STATUSES).toEqual(["active", "trialing"]);
  });

  it("reconnaît les statuts éligibles", () => {
    expect(isEntitledSubscriptionStatus("active")).toBe(true);
    expect(isEntitledSubscriptionStatus("trialing")).toBe(true);
    expect(isEntitledSubscriptionStatus("canceled")).toBe(false);
    expect(isEntitledSubscriptionStatus(null)).toBe(false);
  });
});
