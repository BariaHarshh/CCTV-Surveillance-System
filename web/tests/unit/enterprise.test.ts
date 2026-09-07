import { describe, expect, it } from "vitest";
import { FORBIDDEN_AUTOMATION_ACTIONS } from "@/lib/enterprise/constants";
import { resolvePolicyEffects } from "@/lib/enterprise/policy-engine";
import {
  evaluateAutomationConditions,
  isForbiddenAutomationAction,
} from "@/lib/enterprise/workflow-engine";

describe("policy engine", () => {
  it("DENY beats ALLOW when both apply", () => {
    const decision = resolvePolicyEffects(
      [
        { effect: "ALLOW", policyId: "pol_allow", name: "Allow writes" },
        { effect: "DENY", policyId: "pol_deny", name: "Deny deletes" },
      ],
      "DELETE_INCIDENT"
    );
    expect(decision.effect).toBe("DENY");
    expect(decision.policyId).toBe("pol_deny");
  });

  it("REQUIRE_APPROVAL beats ALLOW when no DENY", () => {
    const decision = resolvePolicyEffects(
      [
        { effect: "ALLOW", policyId: "pol_allow", name: "Allow" },
        { effect: "REQUIRE_APPROVAL", policyId: "pol_appr", name: "Need approval" },
      ],
      "NOTIFY_TEAM"
    );
    expect(decision.effect).toBe("REQUIRE_APPROVAL");
  });
});

describe("forbidden automation actions", () => {
  it("detects hard-blocked actions", () => {
    expect(FORBIDDEN_AUTOMATION_ACTIONS).toContain("DISABLE_ALL_CAMERAS");
    expect(isForbiddenAutomationAction("DISABLE_ALL_CAMERAS")).toBe(true);
    expect(isForbiddenAutomationAction("CREATE_ALERT")).toBe(false);
  });
});

describe("automation conditions", () => {
  it("evaluates eq / gte / in operators", () => {
    expect(
      evaluateAutomationConditions([{ field: "severity", op: "eq", value: "HIGH" }], {
        severity: "HIGH",
      }).pass
    ).toBe(true);

    expect(
      evaluateAutomationConditions([{ field: "severity", op: "eq", value: "HIGH" }], {
        severity: "LOW",
      }).pass
    ).toBe(false);

    expect(
      evaluateAutomationConditions([{ field: "score", op: "gte", value: 80 }], { score: 90 }).pass
    ).toBe(true);

    expect(
      evaluateAutomationConditions([{ field: "type", op: "in", value: ["A", "B"] }], {
        type: "B",
      }).pass
    ).toBe(true);
  });
});
