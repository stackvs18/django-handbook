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
      "Departments, doctors, patients, appointments and prescriptions. A REST API with JWT login, role-based permissions, double-booking checks, plus a server-rendered dashboard.",
    stack: ["Django", "DRF", "SimpleJWT", "django-filter", "Templates"],
    level: "Easy → Hard",
  },
  {
    slug: "inventory",
    title: "Inventory Management System",
    summary:
      "Categories, suppliers, products, stock in/out movements and purchase orders. Atomic stock updates, low-stock alerts, stock value reports, JWT auth and a dashboard.",
    stack: ["Django", "DRF", "SimpleJWT", "django-filter", "Templates"],
    level: "Easy → Hard",
  },
];

export function getProject(slug: string) {
  return PROJECTS.find((p) => p.slug === slug);
}
