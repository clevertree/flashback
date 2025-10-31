# Next Steps: CLI Testing & Code Coverage Strategy

## Current Situation

You have two separate but complementary codebases:

1. **CLI Application** (`cli/commands.rs` + REPL)
   - 15 commands defined
   - Tested via `scripts/cli-e2e.sh`
   - **Coverage:** Tested by scripts, NOT by UI code

2. **GUI Application** (React UI + Tauri backend)
   - 18 Tauri command endpoints
   - Tested via WebdriverIO e2e tests (when tauri-driver available)
   - **Coverage:** 100% of Tauri commands used by UI

---

## What You Asked For

> "We want to make sure all cli commands are used by the ui (code coverage) so that we know what UI features still need to be built"

**Translation:** "Track which CLI commands are callable/tested from the UI"

---

## Analysis Result

**Bottom Line:** CLI commands are NOT callable from the UI.

This is by design because:
- CLI commands go through a REPL interface (`cli/commands.rs`)
- UI goes through Tauri IPC endpoints (`main.rs`)
- These are separate code paths with different responsibilities

---

## Three Options Going Forward

### Option 1: Maintain Current Separation (RECOMMENDED)
**Approach:** Document that CLI and UI are separate, intentional code paths.

**Steps:**
1. ✅ DONE: Created `CLI_CODE_COVERAGE.md` showing the analysis
2. TODO: Update `docs/DEVELOPMENT_RULES.md` with this note:
   ```markdown
   ## CLI vs UI Testing Strategy
   
   - **CLI Code** (`src-tauri/src/cli/`) is tested via shell scripts (`scripts/cli-e2e.sh`)
   - **UI Code** (React components + Tauri commands) is tested via GUI e2e tests
   - These are separate test vectors and should be tested independently
   - Some features may have both CLI and UI entry points (e.g., `gen-key` → `ui_generate_user_keys_and_cert`)
   ```

**Pros:**
- ✅ No code changes needed
- ✅ Clear separation of concerns
- ✅ CLI can be tested independently of UI

**Cons:**
- ❌ Potential code duplication between CLI handlers and Tauri commands
- ❌ Bug fixes need to be made in both places

**Effort:** ~5 minutes (just documentation)

---

### Option 2: Create Mapping Document
**Approach:** Document which CLI commands map to which Tauri commands/UI features.

**Steps:**
1. ✅ DONE: Created mapping in `CLI_CODE_COVERAGE.md`
2. TODO: Create a maintenance guide showing:
   - Which UI component tests each feature
   - Which CLI command implements the same feature
   - When they diverge (CLI-only vs UI-only)

**Pros:**
- ✅ Very clear documentation
- ✅ Helps new developers understand the codebase
- ✅ Easy to spot missing features

**Cons:**
- ❌ Still requires manual testing of both paths
- ❌ Documentation can go out of sync

**Effort:** ~15 minutes (create a nice table/document)

---

### Option 3: Refactor to Shared Library (BEST LONG-TERM)
**Approach:** Extract CLI command handlers into `lib.rs`, make both CLI and UI call the same functions.

**Steps:**
1. In `src-tauri/src/lib.rs`, add handler functions:
   ```rust
   pub async fn handle_gen_key(args: GenKeyArgs) -> Result<KeyResult, String> {
       // Shared implementation
   }
   
   pub async fn handle_api_register(state: &AppState) -> Result<String, String> {
       // Shared implementation
   }
   // etc...
   ```

2. Update `src/cli/commands.rs` to call lib handlers:
   ```rust
   CliCommand::GenKey { email, password, bits, alg, reuse_key } => {
       let args = GenKeyArgs { email, password, bits, alg, reuse_key };
       client::handle_gen_key(args).await?
   }
   ```

3. Update `src/main.rs` Tauri commands to call same handlers:
   ```rust
   #[tauri::command]
   async fn ui_generate_user_keys_and_cert(args: GenerateArgs) -> Result<...> {
       client::handle_gen_key(args).await
   }
   ```

**Pros:**
- ✅ Single source of truth (DRY principle)
- ✅ CLI and UI automatically have parity
- ✅ Easier to test (unit test handler once)
- ✅ Easier to maintain (bug fix in one place)

**Cons:**
- ❌ Requires refactoring existing code
- ❌ Effort: ~4-8 hours (depending on complexity)

**Effort:** Medium-High (~6 hours)

---

## Recommendation

**Do Option 1 now + Option 3 in the future:**

### Immediate Action (10 minutes)
Add this to `docs/DEVELOPMENT_RULES.md`:

```markdown
## Code Coverage Strategy

### CLI vs GUI Testing
- **CLI Code** is tested via shell scripts in `scripts/cli-*.sh`
- **GUI Code** is tested via GUI e2e tests (WebdriverIO)
- These are separate test vectors for separate user interfaces

### When to Add Both CLI and GUI Code
If adding a new feature that should work in both CLI and GUI:
1. Add the handler logic to `src-tauri/src/lib.rs` as a shared function
2. Call it from `src-tauri/src/cli/commands.rs` (for CLI REPL)
3. Call it from `src-tauri/src/main.rs` #[tauri::command] (for GUI)
4. Test both paths

### Current Coverage
- CLI commands: Tested by `scripts/cli-e2e.sh` ✅
- Tauri endpoints: Tested by GUI e2e tests ✅  
- Shared library: Unit tests in lib.rs (to be added as features are extracted)

See `CLI_CODE_COVERAGE.md` for detailed mapping.
```

### Optional Next Phase (when refactoring)
Extract CLI handlers to lib.rs following the pattern above. This ensures:
- Every CLI command has a corresponding lib.rs function
- Every GUI feature tests the same function
- Single source of truth
- Automatic CLI/UI parity

---

## Files Created This Session

1. **`CLI_CODE_COVERAGE.md`** - Detailed analysis of CLI command coverage
2. **`CLI_COVERAGE_SUMMARY.md`** - Visual summary with decision matrix
3. **`CLI_vs_UI_FEATURES.md`** - Original (can be archived or removed)

---

## What to Do Right Now

Choose one:

**Option A (Lazy):** Do nothing, CLI and UI continue separate
- PRO: No work
- CON: Potential divergence

**Option B (Smart):** Document the approach in DEVELOPMENT_RULES.md
- PRO: ~10 min effort, prevents confusion
- CON: Doesn't solve root cause

**Option C (Best):** Extract handlers to lib.rs when adding new features
- PRO: Achieves single source of truth over time
- CON: Requires discipline/refactoring

**Recommendation:** Pick Option B now, evolve to Option C when refactoring.
