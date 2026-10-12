**Django is a free, open-source web framework written in Python.** It gives you a ready-made structure and a large set of tools for building websites and web APIs, so you can spend your time on *your* idea instead of re-inventing logins, database code and security for the hundredth time.

Its official tagline is *"The web framework for perfectionists with deadlines."* That sums it up: Django helps you build things properly, and quickly.

## What is a web framework?

When you visit a website, your browser sends a **request** to a server, and the server sends back a **response** (usually an HTML page or some JSON data). Writing a server from scratch means solving the same problems every time:

- Which code should run for `/products/42/`?
- How do I read and save data in a database without writing raw SQL everywhere?
- How do I generate HTML pages with data in them?
- How do users sign up, log in and stay logged in?
- How do I protect forms from attackers?

A **web framework** is a collection of code that already solves these problems. You fill in the parts that are unique to your project. Think of it like building a house with a pre-made frame, plumbing and wiring: you choose the rooms and decorate them.

## Batteries included

Django's philosophy is **"batteries included"**. Out of the box, with no extra installs, you get:

| Feature | What it does for you |
|---|---|
| **URL routing** | Maps addresses like `/blog/2024/` to Python functions |
| **ORM** | Lets you use the database with Python classes instead of SQL |
| **Migrations** | Keeps your database tables in sync with your code |
| **Template engine** | Generates HTML pages with data filled in |
| **Forms** | Renders HTML forms and validates what users submit |
| **Authentication** | Users, passwords, login, logout, permissions, groups |
| **Admin site** | A complete data management dashboard, generated automatically |
| **Security** | Protection against CSRF, XSS, SQL injection and clickjacking |
| **Sessions & messages** | Remember things between requests, show one-time notices |
| **Caching, email, i18n** | Built-in support for caching, sending email and translations |

Add **Django REST Framework** (a separate package) and you can also build professional JSON APIs for mobile apps and JavaScript frontends. That is covered in [Part 5](/learn/rest-apis).

## A short history

Django was created in **2003–2005** by Adrian Holovaty and Simon Willison, web developers at the *Lawrence Journal-World* newspaper in Kansas, USA. Newsrooms need to publish fast, under tight deadlines, which explains Django's focus on speed of development and its famous admin site (originally for journalists to enter stories).

It was released as open source in **July 2005** and named after the jazz guitarist **Django Reinhardt**. Today it is maintained by the non-profit **Django Software Foundation** and a large community of volunteers, with a new feature release roughly every eight months and a **Long-Term Support (LTS)** release every two years that receives security fixes for about three years.

> [!TIP] Which version should I use?
> For learning and new projects, use the latest stable release (Django 6.x) or the current LTS (Django 5.2). Everything in this handbook works on both. Check yours with `python -m django --version`.

## Who uses Django?

Django runs some very large websites. Well-known examples include **Instagram**, **Pinterest**, **Mozilla**, **Disqus**, **Eventbrite**, **The Washington Post** and parts of **Spotify** and **NASA**. It is equally common for small startups, internal company tools, school projects and freelance work.

## What can you build with it?

- Content sites: blogs, news sites, documentation, portfolios
- Web applications: dashboards, booking systems, school or hospital management systems, CRMs
- E-commerce: product catalogues, carts, orders, payments
- Social platforms: profiles, posts, comments, likes, followers
- **REST APIs** that power mobile apps and React/Vue/Angular frontends
- Data-heavy tools: reporting, admin panels for machine learning projects

## Django's design principles

These ideas show up everywhere in Django. Knowing them helps the rest of the framework make sense.

**DRY: Don't Repeat Yourself.** Define something once. You describe a model once, and Django uses that description to build the database table, the admin pages and the forms.

**Loose coupling.** The pieces (URLs, views, templates, models) are separate and talk through clear interfaces. You can swap a template engine or a database without rewriting everything.

**Explicit is better than implicit.** Borrowed from Python itself. Django prefers you to write a line of configuration rather than rely on hidden magic.

**Less code.** Common tasks such as "show a list of objects" or "save this form" take only a few lines.

**Secure by default.** Many protections are switched on automatically; you have to go out of your way to turn them off.

## Django compared to other Python frameworks

| | Django | Flask | FastAPI |
|---|---|---|---|
| Style | Full-stack, batteries included | Micro-framework, pick your own parts | API-first, async |
| ORM & migrations | Built in | Add-on (e.g. SQLAlchemy) | Add-on |
| Admin site | Built in | Add-on | No |
| Auth system | Built in | Add-on | Build it yourself |
| Best for | Complete web apps and APIs, fast | Small apps, full control | High-performance JSON APIs |
| Learning curve | Medium: more to learn, less to build | Gentle start, more decisions later | Gentle if you know type hints |

None is "the best". Django shines when you want a complete, secure application without assembling a dozen libraries yourself.

## Strengths and trade-offs

**Strengths**

- Very fast to go from idea to working product
- Mature, stable and extremely well documented
- Strong security defaults
- Huge ecosystem of reusable packages (`django-allauth`, `django-filter`, `djangorestframework`, `celery`, ...)
- Scales from a weekend project to sites with millions of users

**Trade-offs**

- It's opinionated: you work *the Django way*, which can feel heavy for a tiny script
- The amount of built-in features can feel like a lot at first
- Real-time features (live chat, websockets) need extra tools such as Django Channels

## How a Django site works, in one picture

Every chapter in this book is a closer look at one part of this journey:

```flow
Browser | Asks for a URL, for example /players/
URL dispatcher (urls.py) | Finds which view handles that URL
View (views.py) | Your Python function. Decides what to do
Model (models.py) | Reads or writes data through the ORM
Template (.html) | Turns the data into an HTML page
Response | Sent back to the browser, which displays it
```

That's the **MVT pattern (Model–View–Template)**, and it gets [its own chapter](/learn/mvt).

## What you need to know before starting

- **Basic Python**: variables, functions, `if`/`for`, lists, dictionaries, classes and imports. You don't need to be an expert.
- **A little HTML** helps for templates.
- **No database knowledge required.** Django's ORM lets you work with Python objects, and this book explains what happens underneath.

## Summary

| Question | Answer |
|---|---|
| What is Django? | A high-level Python web framework |
| Who made it? | Adrian Holovaty and Simon Willison, at a newspaper |
| First public release | July 2005 |
| Architecture | MVT: Model, View, Template |
| Philosophy | Batteries included, DRY, secure by default |
| License | BSD (free and open source) |
| Maintained by | Django Software Foundation |

## Check yourself

<details>
<summary>What does "batteries included" mean?</summary>

Django ships with most things a web application needs (ORM, admin, authentication, forms, security, templates) built in, so you don't have to find and wire together separate libraries.
</details>

<details>
<summary>What does DRY stand for, and how does Django apply it?</summary>

*Don't Repeat Yourself.* For example, you define a model once and Django derives the database table, admin pages and forms from that single definition.
</details>

<details>
<summary>When might Flask or FastAPI be a better choice than Django?</summary>

For very small services where you want to choose every component yourself (Flask), or for API-only services where async performance and automatic type-based validation matter most (FastAPI).
</details>
