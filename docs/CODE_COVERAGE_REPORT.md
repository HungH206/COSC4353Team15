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

```text
Overall line coverage: 83.90%
Overall branch coverage: 76.36%
Overall function coverage: 87.56%
Overall statement coverage: 83.90% (line coverage used as proxy; node --test does not report statements separately)
```

Submission status:

```text
Meets 70-80% backend coverage requirement: Yes
```

## Terminal Output Summary

Final coverage table from `npm run coverage` (49 tests, all passing):

```text
ℹ tests 49
ℹ pass 49
ℹ fail 0
ℹ duration_ms 5782.7892
ℹ start of coverage report
ℹ --------------------------------------------------------------------------------------------
ℹ file                          | line % | branch % | funcs % | uncovered lines
ℹ --------------------------------------------------------------------------------------------
ℹ src                           |        |          |         |
ℹ  app.js                       |  86.76 |    66.67 |   25.00 | 23-24 44 57 60-64
ℹ  modules                      |        |          |         |
ℹ   auth.js                     |  94.17 |    78.89 |  100.00 | 60-61 85-86 196-202 206-208 282-283 296-297
ℹ   chatbot.js                  |  65.37 |    48.53 |   75.00 | 63-67 98-102 105-109 112-115 ...
ℹ   history.js                  |  85.44 |    63.33 |   85.00 | 71-75 87-97 122-127 159-160 ...
ℹ   notifs.js                   |  85.31 |    80.00 |   84.00 | 87-97 120-130 162-163 172-173
ℹ   queue.js                    |  90.71 |    72.62 |   90.24 | 69 177-178 219-220 226-252 ...
ℹ   reports.js                  |  49.14 |    62.50 |   80.00 | 4-9 11-13 34-67 70-192 ...
ℹ   services.js                 |  84.77 |    72.73 |   81.48 | 55-65 68-74 150-156 167-168 ...
ℹ   time_estimation.js          |  94.79 |    74.19 |  100.00 | 16-17 41-43
ℹ  repositories                 |        |          |         |
ℹ   supabaseQueries.js          |  52.00 |    66.67 |   33.33 | 12-14 17-25
ℹ  supabase.js                  |  25.00 |   100.00 |    0.00 | 4-17 20-24 27-28
ℹ test                          |        |          |         |
ℹ  auth.test.js                 | 100.00 |   100.00 |  100.00 |
ℹ  chatbot.test.js              | 100.00 |    93.33 |  100.00 |
ℹ  database_integration.test.js |  91.05 |    87.76 |   84.44 | 28-30 65-69 94-96 108-119
ℹ  history.test.js              | 100.00 |    93.33 |  100.00 |
ℹ  notifications.test.js        | 100.00 |    94.12 |  100.00 |
ℹ  queue.test.js                |  63.93 |    94.12 |   93.75 | 27-127
ℹ  reports.test.js              | 100.00 |    94.12 |  100.00 |
ℹ  services.test.js             |  75.40 |    91.67 |   90.91 | 18-63
ℹ  time_estimation.test.js      |  92.51 |    88.89 |   90.70 | 58-71 74-77 86-89 97
ℹ --------------------------------------------------------------------------------------------
ℹ all files                     |  83.90 |    76.36 |   87.56 |
ℹ --------------------------------------------------------------------------------------------
ℹ end of coverage report
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