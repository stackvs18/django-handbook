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
      "Departments, doctors, receptionists, patients and appointments. Beginner-level: plain models, a login-only ModelViewSet API with JWT, a double-booking check, doctors who see only their own appointments, and ModelForm web pages.",
    stack: ["Django", "DRF", "SimpleJWT", "Templates"],
    level: "Beginner",
  },
  {
    slug: "inventory",
    title: "Inventory Management System",
    summary:
      "Categories, suppliers, products and stock in/out. Beginner-level: a login-only ModelViewSet API with JWT, stock that can never go negative, low-stock alerts and ModelForm web pages.",
    stack: ["Django", "DRF", "SimpleJWT", "Templates"],
    level: "Beginner",
  },
];

export function getProject(slug: string) {
  return PROJECTS.find((p) => p.slug === slug);
}
