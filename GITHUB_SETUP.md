# 🐙 GitHub Setup & Team Collaboration Guide

Guide for initializing Git, pushing to GitHub, and collaborating as a 5-member development team.

---

## 1. Initializing Git Repository & First Push

Team Lead / Maintainer instructions to set up the repository on GitHub:

```bash
# 1. Initialize Git repository locally
git init

# 2. Add all files to staging
git add .

# 3. Create initial commit
git commit -m "Initial project setup with Crowd Detection module"

# 4. Set main branch
git branch -M main

# 5. Connect to GitHub remote repository
git remote add origin <GITHUB_REPOSITORY_URL>

# 6. Push initial commit
git push -u origin main
```

---

## 2. Recommended Team Branching Strategy

To keep `main` stable, team members should work on dedicated feature branches:

```text
main
  │
  ├── feature/crowd-detection
  ├── feature/restricted-area
  ├── feature/abandoned-object
  ├── feature/risk-assessment
  └── feature/behavior-detection
```

---

## 3. Team Developer Workflow

### Step 1: Clone Repository
```bash
git clone <GITHUB_REPOSITORY_URL>
cd AI-Campus-Guard
```

### Step 2: Create a Feature Branch
Before starting work on your assigned module, create a feature branch:
```bash
git checkout -b feature/restricted-area
```

### Step 3: Develop & Commit
Make changes inside your assigned folder (e.g. `features/restricted_area/`):
```bash
git add .
git commit -m "Add restricted area ROI polygon mask logic"
```

### Step 4: Push Feature Branch & Open Pull Request (PR)
```bash
git push -u origin feature/restricted-area
```
Go to GitHub, create a **Pull Request** to `main`, tag a teammate for review, and merge upon approval!
