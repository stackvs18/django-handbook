export type Chapter = {
  slug: string;
  title: string;
  summary: string;
};

export type Part = {
  id: string;
  title: string;
  blurb: string;
  chapters: Chapter[];
};

export const PARTS: Part[] = [
  {
    id: "start",
    title: "Getting Started",
    blurb: "What Django is, how the web works, and your first working project.",
    chapters: [
      {
        slug: "what-is-django",
        title: "What is Django?",
        summary: "The framework, its philosophy, and what you can build with it.",
      },
      {
        slug: "how-the-web-works",
        title: "How the Web Works",
        summary: "Requests, responses, HTTP methods and status codes. The ground everything stands on.",
      },
      {
        slug: "setup",
        title: "Setting Up Your Machine",
        summary: "Python, virtual environments, pip and installing Django.",
      },
      {
        slug: "mvt",
        title: "The MVT Architecture",
        summary: "Model, View, Template, and how a request travels through them.",
      },
      {
        slug: "first-project",
        title: "Your First Project in 14 Steps",
        summary: "Build a complete app from an empty folder, one step at a time.",
      },
      {
        slug: "project-structure",
        title: "Anatomy of a Project",
        summary: "Every file Django generates, what it does, and a tour of settings.py.",
      },
    ],
  },
  {
    id: "core",
    title: "Core Django",
    blurb: "URLs, views, templates, models, the ORM, admin and forms in depth.",
    chapters: [
      {
        slug: "urls",
        title: "URLs & Routing",
        summary: "path(), converters, include(), names, namespaces and reverse().",
      },
      {
        slug: "views",
        title: "Views",
        summary: "Function-based views, the request object, render, redirect and JSON.",
      },
      {
        slug: "templates",
        title: "Templates",
        summary: "The Django Template Language: variables, tags, filters and inheritance.",
      },
      {
        slug: "static-and-media",
        title: "Static & Media Files",
        summary: "CSS, JavaScript, images and user uploads.",
      },
      {
        slug: "models",
        title: "Models & Fields",
        summary: "Describe your data as Python classes. Field types, options and Meta.",
      },
      {
        slug: "relationships",
        title: "Model Relationships",
        summary: "ForeignKey, OneToOneField and ManyToManyField explained with examples.",
      },
      {
        slug: "migrations",
        title: "Migrations",
        summary: "How Django turns model changes into database changes, safely.",
      },
      {
        slug: "orm",
        title: "The ORM & QuerySets",
        summary: "Create, read, update, delete, lookups, Q, F, aggregation and performance.",
      },
      {
        slug: "admin",
        title: "The Admin Site",
        summary: "A full data management UI for free, and how to customise it.",
      },
      {
        slug: "forms",
        title: "Forms & Validation",
        summary: "Form, ModelForm, cleaning, validation and rendering.",
      },
      {
        slug: "class-based-views",
        title: "Class-Based Views",
        summary: "ListView, DetailView, CreateView and friends. Less code for common pages.",
      },
    ],
  },
  {
    id: "users",
    title: "Users & Security",
    blurb: "Accounts, login, permissions, sessions and keeping your site safe.",
    chapters: [
      {
        slug: "authentication",
        title: "Users & Authentication",
        summary: "Register, login, logout and protecting pages.",
      },
      {
        slug: "permissions",
        title: "Permissions & Custom Users",
        summary: "Groups, permissions, and replacing the default User model.",
      },
      {
        slug: "sessions-and-messages",
        title: "Sessions, Cookies & Messages",
        summary: "Remembering things between requests and flashing notices to users.",
      },
      {
        slug: "security",
        title: "Security Essentials",
        summary: "CSRF, XSS, SQL injection, clickjacking and safe settings.",
      },
    ],
  },
  {
    id: "projects",
    title: "Build Projects",
    blurb: "Put it all together in two complete, working applications.",
    chapters: [
      {
        slug: "crud-project",
        title: "Project: A Full CRUD App",
        summary: "Create, read, update, delete and search, built with ModelForms.",
      },
      {
        slug: "auth-project",
        title: "Project: Accounts & Private Data",
        summary: "Sign up, log in, and let every user manage only their own records.",
      },
    ],
  },
  {
    id: "drf",
    title: "REST APIs with DRF",
    blurb: "Django REST Framework, serializers, viewsets, JWT and role-based APIs.",
    chapters: [
      {
        slug: "rest-apis",
        title: "APIs & REST",
        summary: "What an API is, JSON, REST rules, and how DRF changes the MVT picture.",
      },
      {
        slug: "drf-first-api",
        title: "DRF: Your First API",
        summary: "Install Django REST Framework and ship a working endpoint.",
      },
      {
        slug: "serializers",
        title: "Serializers",
        summary: "Converting models to JSON and back, with validation and nesting.",
      },
      {
        slug: "api-views",
        title: "APIView & Generic Views",
        summary: "Class-based API views, mixins and the generic view shortcuts.",
      },
      {
        slug: "viewsets-routers",
        title: "ViewSets & Routers",
        summary: "A whole CRUD API from one class and one line of URL config.",
      },
      {
        slug: "api-authentication",
        title: "API Authentication",
        summary: "Session, Basic and Token authentication in DRF.",
      },
      {
        slug: "jwt",
        title: "JWT Authentication",
        summary: "JSON Web Tokens with SimpleJWT: access, refresh, rotation and logout.",
      },
      {
        slug: "api-permissions",
        title: "Permissions & Role-Based APIs",
        summary: "Built-in permission classes, custom permissions and user roles.",
      },
      {
        slug: "filtering-pagination",
        title: "Filtering, Pagination & Throttling",
        summary: "Search, ordering, filters, paging large lists and rate limiting.",
      },
      {
        slug: "postman",
        title: "Testing APIs with Postman",
        summary: "Send requests, use tokens, environments, collections and test scripts.",
      },
      {
        slug: "api-best-practices",
        title: "Versioning & Best Practices",
        summary: "API versioning, CORS, documentation and a production checklist.",
      },
      {
        slug: "api-project",
        title: "Project: A JWT-Secured API",
        summary: "A complete REST API with JWT login, roles and owner-only editing.",
      },
    ],
  },
  {
    id: "further",
    title: "Going Further",
    blurb: "Raw SQL, middleware, signals, testing, performance and deployment.",
    chapters: [
      {
        slug: "sqlite3",
        title: "Python's sqlite3 Module",
        summary: "connect, cursor, execute, fetch, commit and rollback without the ORM.",
      },
      {
        slug: "middleware-and-signals",
        title: "Middleware & Signals",
        summary: "Hooks that run on every request, and events fired by your models.",
      },
      {
        slug: "testing",
        title: "Testing",
        summary: "Automated tests for models, views and APIs.",
      },
      {
        slug: "performance",
        title: "Caching & Performance",
        summary: "Fewer queries, smarter queries, and caching what is expensive.",
      },
      {
        slug: "email-tasks-async",
        title: "Email, Tasks & Async",
        summary: "Sending email, background work and async views.",
      },
      {
        slug: "deployment",
        title: "Deployment",
        summary: "From runserver to a real server: settings, static files and hosting.",
      },
    ],
  },
  {
    id: "appendix",
    title: "Appendix",
    blurb: "Quick reference for when you just need the command.",
    chapters: [
      {
        slug: "cheatsheet",
        title: "Cheat Sheet",
        summary: "Every command and code pattern from this book on one page.",
      },
      {
        slug: "glossary",
        title: "Glossary",
        summary: "Django and web terms in plain English.",
      },
    ],
  },
];

export type FlatChapter = Chapter & {
  number: number;
  part: Pick<Part, "id" | "title">;
  partNumber: number;
};

export const CHAPTERS: FlatChapter[] = PARTS.flatMap((part, partIndex) =>
  part.chapters.map((chapter) => ({
    ...chapter,
    part: { id: part.id, title: part.title },
    partNumber: partIndex + 1,
  })),
).map((chapter, index) => ({ ...chapter, number: index + 1 }));

export function getChapter(slug: string) {
  const index = CHAPTERS.findIndex((c) => c.slug === slug);
  if (index === -1) return null;
  return {
    chapter: CHAPTERS[index],
    prev: CHAPTERS[index - 1] ?? null,
    next: CHAPTERS[index + 1] ?? null,
  };
}
