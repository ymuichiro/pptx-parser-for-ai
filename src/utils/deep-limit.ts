import { MAX_ARRAY_LENGTH, MAX_NESTING_DEPTH, MAX_STRING_LENGTH } from "../constants";

export interface LimitViolation {
  path: string;
  reason: string;
}

export function enforceStructuralLimits(
  value: unknown,
  path = "$",
  depth = 0,
  violations: LimitViolation[] = []
): LimitViolation[] {
  if (depth > MAX_NESTING_DEPTH) {
    violations.push({
      path,
      reason: `Nesting depth exceeded ${MAX_NESTING_DEPTH}`
    });
    return violations;
  }

  if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
    violations.push({
      path,
      reason: `String length exceeded ${MAX_STRING_LENGTH}`
    });
    return violations;
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      violations.push({
        path,
        reason: `Array length exceeded ${MAX_ARRAY_LENGTH}`
      });
      return violations;
    }

    value.forEach((item, index) => {
      enforceStructuralLimits(item, `${path}[${index}]`, depth + 1, violations);
    });

    return violations;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      enforceStructuralLimits(child, `${path}.${key}`, depth + 1, violations);
    }
  }

  return violations;
}
