# Batch 1 Final Report: PR-6 + PR-7

## PR-6: V2 Portability Envelope and Backward Loaders

### CRITICAL (3)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| C1 | **Missing HouseholdPlan Zod schema** — `STORE_SCHEMAS` has no entry for `fireplanner-household-plan-v1`, so `validateStoreData` skips validation during JSON import. Malformed household data persists to localStorage and crashes on reload. The internal `validateHouseholdPlan` exists but isn't wired into the import pipeline. | `validation/schemas.ts:359` | Codex, Gemini, Plan Compliance |
| C2 | **`shouldClearLegacyAuthoringStores` inverted for single-adult plans** — `buildRuntimeStores` always materializes legacy keys via `toLegacyIndividual` for one-adult plans, so the `!LEGACY_AUTHORING_STORE_KEYS.some(key => key in runtimeStores)` check is always false. Legacy localStorage entries accumulate indefinitely. Only multi-adult plans (where `toLegacyIndividual` returns null) trigger cleanup. | `storeRegistry.ts:369-377` | Code Reviewer, Plan Compliance |
| C3 | **Test failure: `legacyAuthoringImports.test.ts`** — `useCompanionPlannerBridge.ts` still imports `useProfileStore`, `useIncomeStore`, `usePropertyStore` (12 direct legacy store reads), but the enforcement test only allows `fromLegacyIndividual.ts` and `storeRegistry.ts`. | `useCompanionPlannerBridge.ts:4-6` | Plan Compliance |

### WARNING (5)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| W1 | **Property migration drops Bala-decay preference** — v8 migration writes `applyBalaDecay`, but the live store uses `existingApplyBalaDecay`; v9 defaults the real field to `true`, silently changing projection assumptions for existing users | `usePropertyStore.ts:257` | Codex |
| W2 | **`storeRegistry.ts` imports all 7 Zustand stores** from `lib/`, creating broad coupling and transitive circular risk. Any file importing `storeRegistry` transitively evaluates all stores. | `storeRegistry.ts:21-34` | Code Architect |
| W3 | **`cloneRetirementWithdrawal` silently blocks legacy conversion** — any monthly-periodicity retirement-withdrawal expense causes `toLegacyIndividual` to return `null` entirely, switching Excel to household format and suppressing legacy runtime stores. No validation error surfaced, no test coverage. | `toLegacyIndividual.ts:136-150` | Code Reviewer |
| W4 | **`useUpdateNudges.ts` duplicates storage key strings** — hardcoded string literals instead of using `storeKeys.ts` constants. If a key is renamed, nudges silently stop working. | `useUpdateNudges.ts:8-16` | Code Architect |
| W5 | **Six scattered `as unknown as Record<string,unknown>` casts** — discards typed `HouseholdPlanPersistedState` structure. Should be consolidated into a single typed coercion helper. | `storeRegistry.ts:130,255,292,309,313,317` | Code Architect |

### MEDIUM (6)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| M1 | Import reports success before localStorage writes confirmed — `writeStoreDataToLocalStorage` swallows failures but `importFromJson` already shows success toast and reloads | `storeRegistry.ts:379`, `exportImport.ts:89` | Codex |
| M2 | `PlanUrlHandler` render-time side effect — `stripPlanFromUrl()` runs during state init, React StrictMode can double-invoke; SPA navigations to shared URL won't re-trigger dialog | `PlanUrlHandler.tsx:14,26` | Codex, Code Reviewer |
| M3 | Household property validation much weaker than legacy — `existingMortgageRate`, `mortgageCpfMonthly`, HDB/downsizing fields never validated in household path | `validation.ts:201` | Codex |
| M4 | `disableLocalStoragePersistence` omits legacy authoring stores — companion-mode data could leak through legacy store persistence if `bootstrapPortabilityStores` materializes them | `companionBridge.ts:25-31` | Plan Compliance |
| M5 | Scenario toast on failure — save/load/delete show success toast even when operation returns `false` | `ScenarioManager.tsx:36` | Codex, Code Reviewer |
| M6 | `companionBridge.ts` uses `as any` with eslint-disable — should use correct `PersistStorage<unknown>` type | `companionBridge.ts:40,46` | Code Architect |

### LOW (4)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| L1 | `main.tsx:10` uses `.tsx` extension in dynamic import, violating no-extension convention | `main.tsx:10` | Code Architect |
| L2 | `STORE_TO_SECTION` constant in hook file; should be in `lib/data/` or `lib/storeKeys.ts` | `useUpdateNudges.ts:8-16` | Code Architect |
| L3 | Scenario name length mismatch: HTML `maxLength={40}` vs code `MAX_SCENARIO_NAME_LENGTH=80` | `scenarios.ts:19`, `ScenarioManager.tsx:84` | Code Architect |
| L4 | Duplicate `isRecord` helper in `storeRegistry.ts` and `scenarios.ts` | both files | Plan Compliance |

---

## PR-7: Household Setup Flow and Feature Flag Gating

### CRITICAL (2)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| C1 | **Feature flag NOT gating StartPage** — `PlanTypeSelector` and `HouseholdSetupWizard` render unconditionally, never checking `isHouseholdPlannerV1Enabled()`. Users see Couple/Household options even with flag off. Violates plan's primary safety invariant. Also causes test failure in `HouseholdSetupWizard.test.tsx`. | `StartPage.tsx:336,375` | Codex, Plan Compliance |
| C2 | **Wizard never retimes seeded rows for age 65+** — `initializeManualPlan` seeds salary ending at 65 and base-living with default timing. For users 65+, the salary row drops out immediately, producing a wrong household plan before any edits. The individual `StartPage` flow handles this via `retimeStarterRows`. | `HouseholdSetupWizard.tsx:74,79` | Codex |

### WARNING (5)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| W1 | **Story-first uses wrong retirement age** — `handleStoryFirstContinue` passes `profile.retirementAge` (default/previous session) instead of calculated `fireAge` shown to user | `StartPage.tsx` | Gemini |
| W2 | **Financial constants hardcoded in StartPage** — `DEFAULT_SWR=0.036`, `DEFAULT_RETURN=0.07`, etc. duplicate identical values from `DEFAULT_PROFILE` in `useProfileStore.ts`. If defaults change, StartPage silently uses old values. | `StartPage.tsx:91-94` | Code Architect |
| W3 | **`removeAdult` fallbackTimingOwner can be null** — if last adult removed, `TimingRule.owner` gets assigned `null` violating the `AdultOwner | 'shared'` type contract | `useHouseholdPlanStore.ts` | Gemini |
| W4 | **No source citation for healthcare defaults** — `oopBaseAmount: 1200` and `oopInflationRate: 0.03` have no source documentation; file not in Annual Data Maintenance Checklist | `defaultHealthcareConfig.ts:8-9` | Code Architect |
| W5 | **Multi-step store mutation in wizard** — `handleCreatePlan` calls 5-6 sequential store actions, each triggering validation. Should be a single atomic `initializeFromSetupWizard()` action. | `HouseholdSetupWizard.tsx:73-117` | Code Architect |

### MEDIUM (7)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| M1 | Router `useEffect` too restrictive — `ensureHouseholdDataVisible` skipped for manual individual plans when household flag is on, causing sidebar section mismatch | `router.tsx:57-63` | Gemini |
| M2 | `deriveHouseholdSectionToggles` called 3 times per render in `PlannerRouteShell` — three selectors each re-derive the full plan traversal independently | `router.tsx:50-52` | Code Architect, Code Reviewer, Plan Compliance |
| M3 | `sectionVisibility` heuristics too narrow — `oopCurveVariant` not checked, so users who only customized curve variant have healthcare section hidden after round-trip | `sectionVisibility.ts:23-33` | Codex, Code Reviewer |
| M4 | Age 89+ produces immediately-invalid plan — age input allows up to 100 but life expectancy seeds at 90, so `retirementAge` exceeds `lifeExpectancy` | `PeopleRosterEditor.tsx:73,112` | Codex |
| M5 | `canCreatePlan` doesn't guard `household + partnerEnabled` path — only couple requires non-empty partner name; household with partner enabled allows blank name | `HouseholdSetupWizard.tsx:71` | Code Reviewer |
| M6 | Section toggle JSX duplicated between wizard and StartPage — same CPF/Healthcare/Property switch block with minor label differences | `HouseholdSetupWizard.tsx:161-202`, `StartPage.tsx:264-309` | Code Architect |
| M7 | `householdStore` captured at render time outside callback — should be inside `handleCreatePlan` for consistency with other `.getState()` calls | `HouseholdSetupWizard.tsx:70` | Code Reviewer, Plan Compliance, Code Architect |

### LOW (3)

| # | Finding | Files | Agents |
|---|---------|-------|--------|
| L1 | Test fragility: switch targeted by positional index `getAllByRole('switch')[0]` with no aria-label | `HouseholdSetupWizard.test.tsx:137` | Code Reviewer |
| L2 | `Math.random()` fallback is dead code in `ids.ts` — `crypto.randomUUID` available in all target envs | `ids.ts:6` | Code Architect |
| L3 | Feature flag read duplicated in Sidebar and router; no shared hook | `Sidebar.tsx:147`, `router.tsx:54` | Code Architect |

---

`★ Insight ─────────────────────────────────────`
The 5-agent structure caught findings that no single reviewer would: Code Architect found the store coupling and hardcoded constants, Code Reviewer found the inverted `shouldClearLegacy` logic, Plan Compliance found the test failure and companion mode gap, Codex found the property migration issue, and Gemini found the `removeAdult` null-owner type violation. The deduplication step is critical — 3 agents independently flagged the missing Zod schema, confirming it as the highest-confidence finding.
`─────────────────────────────────────────────────`

**Total: PR-6 has 18 findings (3 critical, 5 warning, 6 medium, 4 low). PR-7 has 17 findings (2 critical, 5 warning, 7 medium, 3 low).**

Ready to launch **Batch 2 (PR-8a, PR-8b, PR-8c)** when you give the go-ahead.