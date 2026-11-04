export type Project = {
  slug: string;
  title: string;
  summary: string;
  stack: string[];
  level: string;
};

export const PROJECTS: Project[] = [
  {
    slug: "hospital",
    title: "Hospital Management System",
    summary:
      "Departments, doctors, receptionists, patients and appointments. Beginner-level: plain models, ModelViewSet API with JWT and three roles, a double-booking check, and simple function-based web pages.",
    stack: ["Django", "DRF", "SimpleJWT", "Templates"],
    level: "Beginner",
  },
  {
    slug: "inventory",
    title: "Inventory Management System",
    summary:
      "Categories, suppliers, products and stock in/out. Beginner-level: register + JWT login, staff-only editing, stock that can never go negative, low-stock alerts and simple web pages.",
    stack: ["Django", "DRF", "SimpleJWT", "Templates"],
    level: "Beginner",
  },
];

export function getProject(slug: string) {
  return PROJECTS.find((p) => p.slug === slug);
}
