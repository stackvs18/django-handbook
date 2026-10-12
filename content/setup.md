To build with Django you need three things: **Python**, a **virtual environment** for your project, and **Django** itself installed inside it. This chapter sets them up properly once so nothing gets in your way later.

## 1. Install Python

Django is a Python package, so Python comes first. Use **Python 3.12 or newer** (Django 6.x requires it; Django 5.2 LTS also works on 3.10 and 3.11).

**Windows**

1. Download the installer from [python.org/downloads](https://www.python.org/downloads/).
2. On the first screen, tick **"Add python.exe to PATH"**. This matters.
3. Click *Install Now*.

**macOS**: install from python.org, or with Homebrew: `brew install python`.

**Linux**: Python is usually installed. If not: `sudo apt install python3 python3-venv python3-pip`.

Check it:

```bash
python --version
```

```text
Python 3.13.1
```

> [!NOTE]
> On macOS and Linux the command is often `python3` instead of `python`, and `pip3` instead of `pip`. Inside an activated virtual environment, plain `python` and `pip` always work.

## 2. Understand pip

`pip` is Python's package installer. It downloads packages from **PyPI** (the Python Package Index):

```bash
pip install django            # install the latest version
pip install "django==5.2.*"   # install a specific version series
pip install --upgrade django  # upgrade
pip uninstall django          # remove
pip list                      # what's installed
pip show django               # details about one package
```

## 3. Create a virtual environment

A **virtual environment** ("venv") is a private folder of packages for one project.

Why bother? Imagine project A needs Django 4.2 and project B needs Django 6.0. If both install into your system Python, one breaks the other. With a venv, each project has its own isolated set of packages.

```bash
mkdir myproject
cd myproject
python -m venv venv
```

This creates a folder called `venv` containing a copy of the Python interpreter and an empty package directory.

## 4. Activate it

You must activate the environment in each new terminal window:

| System | Command |
|---|---|
| Windows (PowerShell) | `venv\Scripts\Activate.ps1` (or just `venv\Scripts\activate`) |
| Windows (Command Prompt) | `venv\Scripts\activate.bat` |
| macOS / Linux | `source venv/bin/activate` |

When active, your prompt shows the name in brackets:

```text
(venv) PS C:\Users\you\myproject>
```

To leave it, type `deactivate`.

> [!WARNING] PowerShell says "running scripts is disabled on this system"
> Run this once, then try activating again:
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

## 5. Install Django

With the venv active:

```bash
pip install django
python -m django --version
```

```text
5.2.7
```

That's it. Django is installed *inside this project's venv only*.

## 6. Save your requirements

Record exactly which packages your project needs so anyone (including future you, or a server) can recreate the environment:

```bash
pip freeze > requirements.txt
```

```text title="requirements.txt"
asgiref==3.8.1
Django==5.2.7
sqlparse==0.5.3
```

Recreating the environment elsewhere:

```bash
python -m venv venv
venv\Scripts\activate          # or: source venv/bin/activate
pip install -r requirements.txt
```

> [!TIP]
> Never commit the `venv` folder to Git. Commit `requirements.txt` instead. Add `venv/` to your `.gitignore`.

## 7. Pick an editor

Any editor works, but **Visual Studio Code** with the official **Python** extension (by Microsoft) is a great free choice. Useful extras:

- **Django** extension: syntax highlighting for template tags
- Select your venv's interpreter: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> → *Python: Select Interpreter* → choose the one inside `venv`

PyCharm (Professional edition has deep Django support) is another popular option.

## 8. Create and run a test project

Let's make sure everything works end to end:

```bash
django-admin startproject mysite .
python manage.py runserver
```

Open **http://127.0.0.1:8000/**. You should see Django's welcome page with a rocket. Press <kbd>Ctrl</kbd> + <kbd>C</kbd> to stop the server.

The `.` at the end of `startproject` means "create it here" instead of inside another new folder.

## The full setup, start to finish

```bash title="Windows"
mkdir myproject
cd myproject
python -m venv venv
venv\Scripts\activate
pip install django
django-admin startproject mysite .
python manage.py runserver
```

```bash title="macOS / Linux"
mkdir myproject && cd myproject
python3 -m venv venv
source venv/bin/activate
pip install django
django-admin startproject mysite .
python manage.py runserver
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `'python' is not recognized` | Python isn't on PATH. Reinstall and tick *Add to PATH*, or use the `py` launcher on Windows |
| `No module named django` | The venv isn't activated, or Django was installed outside it |
| `django-admin: command not found` | Use `python -m django startproject mysite` instead |
| Activation fails in PowerShell | Run the `Set-ExecutionPolicy` command shown above |
| Wrong Python in VS Code | *Python: Select Interpreter* and choose the venv |

## Check yourself

<details>
<summary>Why use a virtual environment instead of installing Django globally?</summary>

To isolate each project's packages and versions, so projects can't break each other, and so you can record exact requirements with `pip freeze`.
</details>

<details>
<summary>How do you check that Django is installed and which version?</summary>

`python -m django --version`
</details>

<details>
<summary>What file lets another developer install exactly the packages you used?</summary>

`requirements.txt`, created with `pip freeze > requirements.txt` and installed with `pip install -r requirements.txt`.
</details>
