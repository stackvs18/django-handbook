import { API_LABS } from "./api-labs";
import { DATA_LABS } from "./data-labs";
import { PYTHON_LABS } from "./python-labs";
import { REQUEST_LABS } from "./request-labs";
import { WEB_LABS } from "./web-labs";
import type { Lab, LabGroup } from "./types";

export const LABS: Lab[] = [...WEB_LABS, ...DATA_LABS, ...REQUEST_LABS, ...API_LABS, ...PYTHON_LABS];

export const LAB_GROUPS: LabGroup[] = [
  "Project",
  "Views & templates",
  "Models & data",
  "Users & requests",
  "REST APIs",
  "Python",
];

export function getLab(slug: string) {
  return LABS.find((l) => l.slug === slug) ?? null;
}
