# QueueSmart Backend Code Coverage Report

## Purpose

This report documents the backend test coverage for QueueSmart. The project requirement is overall backend code coverage of at least 70-80%.

## How To Re-run Coverage

Run these commands from the project root:

```bash
cd backend
npm install
npm run coverage
```

If port `3000` is already being used by a local backend server, stop it first:

```bash
lsof -i :3000
kill <PID>
```

Then run coverage again:

```bash
npm run coverage
```

## Coverage Summary

Fill this section after running `npm run coverage`.

```text
Overall line coverage: ___%
Overall branch coverage: ___%
Overall function coverage: ___%
Overall statement coverage: ___%
```

Submission status:

```text
Meets 70-80% backend coverage requirement: Yes / No
```

## Terminal Output Summary

Paste the final coverage table from the terminal here:

```text
PASTE COVERAGE SUMMARY HERE
```

## Screenshot

Take a screenshot of the terminal after `npm run coverage` finishes and save it in:

```text
docs/screenshots/backend-coverage.png
```

Screenshot included:

```text
docs/screenshots/backend-coverage.png
```

## Notes

- Coverage was generated using Node's built-in test runner.
- The backend test command is `node --test --experimental-test-coverage`.
- The report should be re-run after major backend changes, especially changes in authentication, queue management, reports, history, notifications, smart wait-time estimation, or the AI chatbot API.
