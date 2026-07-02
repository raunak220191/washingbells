## Stream-timeout prevention (hard rules)
1. Do ONE task at a time. Finish it, confirm, commit, then move on. Never batch
   many steps into a single response.
2. Never write or rewrite a file longer than ~150 lines in one tool call. Split
   larger files into multiple smaller edit/append passes.
3. After editing, do NOT idle waiting for Fast Refresh. Make the edit, commit, then
   reload + screenshot as a separate explicit step with a bounded wait. If a reload
   hangs, restart Metro with `npx expo start -c` rather than waiting.
4. Keep tool output small — avoid commands that dump hundreds of lines; pipe to head/grep.
5. Commit after every discrete change so a timeout only costs the current step, not the run.
## Interaction & backend rules (always)
1. NEVER wait open-endedly on anything. Every device tap, screenshot, reload, or
   network call gets a bounded wait. If it doesn't return in ~60s, abandon it and
   move on — do not sit idle waiting (idle waits cause stream timeouts).
2. Test backends through the API, not the UI. To verify any backend behavior, call
   the endpoint directly (curl localhost:8000/...), assert on the response, and log
   it. Use the UI only to verify visual/UX, never to probe whether an API works.
3. When a UI action hangs or errors, STOP tapping. Switch immediately to: read the
   relevant handler in code, reproduce with a direct API call, diagnose from the
   response. The UI tap rarely reveals the cause; the API response does.
4. Work in small steps; commit after each so any stall costs one step, not the run.