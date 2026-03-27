## AI Agents Strategy

Purpose: document the AI helpers that will coordinate aspects of *Phantom Rebound* development and runtime behavior, with a focus on scalable mobile design.

### Roles
- **Creative Agent** – formulates high-level narrative, pacing, and level-design inspirations that keep gameplay fresh across mobile sessions.
- **Optimization Agent** – tracks performance targets (frame budget, asset loading, memory footprints) and recommends platform-appropriate techniques.
- **Automation Agent** – manages repeatable tasks such as build/test runs, asset imports, and content pipelines to keep iteration fast.

### Workflows
1. **Project Planning** – Creative + Optimization agents align on caps for mobile-friendly interactions, documenting them in `docs/mobile-guide.md` (placeholder).
2. **Asset Pipeline** – Automation agent batches assets in `example.assets` for profiling, tags them by resolution/size, and relays findings to Optimization.
3. **Playtesting Loop** – Creative agent defines scenarios, Automation schedules smoke tests, Optimization reviews telemetry for frame drops.

### Scaling Checklist
- Target 60 fps on midrange hardware (Android API 31 / iOS 15) with adaptive quality tiers.
- Modular input handling to switch fluidly between touch, gyro, and controller.
- Cloud-synced state + lightweight serialization for quick sessions.
- Use incremental builds: prioritize hot-reload friendly scripts (look into `src/` layout).
- Bump the in-game version identifier (and any release metadata) on every push so mobile stores and QA always get a fresh build signal.
- Treat version bump as a hard gate: do not push if `src/data/version.js`, `version.json`, `index.html` fallback banner, `window.__APP_BUILD__`, and the `script.js`/`styles.css` cache-busting query strings are not updated for that push.
