## Code Provenance

**The Problem**

AI IDEs rules the developer workdflow. Developers accept tab completions, agentic coding, and paste block suggestions, and let tools like Bob, GitHub Copilot, Cursor, Antigravity and Windsurf write entire functions or modules. 

This is great for speed, but it creates a **compliance blind spot**. 

When an auditor asks `who wrote this authentication code, and how was it generated?`, there is no answer. If it is good; developers get credit. If it is bad; AI tools get blamed. 

There is no trail. 

Regulated industries like healthcare and finance face real exposure: HIPAA violations from AI-generated patient data handling, PCI-DSS gaps in payment flows, GDPR breaches buried in privacy logic. It will take millions of dollars to fix these issues later. 

Legal liability lands on the team, and no one can even point to the origin of the problem.

**The Solution**

Code Provenance is a VS Code extension that works like `git blame for AI-generated code.` It automatically detects when code is inserted by an AI tool and records a complete, tamper-evident record of who generated what, when, from which model, in which file, and at what compliance risk level without the developer doing anything manually.

The detection engine watches text document changes in real time and scores them. It identifies AI-generated insertions by analyzing signals: typing speed, block size, insertion patterns that match tab completions, and structural code signatures like full function or class definitions appearing in milliseconds. 

When a match is found, the system captures a provenance record including the file path, line range, language, a SHA-256 hash of the code, the timestamp, confidence score, and automatically applied compliance flags for HIPAA, GDPR, PCI-DSS, and SOX based on what the code actually contains.

That metadata is stored in two places: a local audit trail in `.vscode/provenance/audit-trail.json` and embedded directly into git attributes so provenance travels with the code through version control. 

**Who Uses It and How**

The primary users are developers, engineering managers, and engineering leads on teams building in regulated industries. 

It runs silently in the background. One time enablement and can be enforced through organization policies and CI/CD pipelines. 

It triggers a notification when AI code is detected and can open the audit dashboard at any time to filter records by risk level, file, date range, or compliance flag. 

High-risk blocks such as anything touching auth, payments, or encryption are flagged automatically for human review.

For compliance officers, the dashboard is a live audit log. The export feeds directly into audit workflows.

**Why It Is Different**

Most attempts at AI attribution are manual: comments, commit messages, pull request descriptions. They rely on developers remembering to label AI-generated code, which almost never happens at scale. This extension does it automatically at the point of generation, using forensics rather than trust. The risk classification and compliance flag detection are applied in real time, not retroactively. 

And because everything is git-integrated, the provenance cannot be quietly dropped before a commit lands in production.