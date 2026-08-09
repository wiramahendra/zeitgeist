EXP-003 COMPILED SUBAGENT REPORT

Experiment: Environment Warmth / Setup Tax
Branch: cursor/exp-003-environment-warmth-1db1
Model: composer-2.5-fast
Decision: REPLICATE (see report.md)
Runs included: 18 authoritative (1 mis-launch excluded)

EXCLUDED RUN (not in manifest)
[EXP-003 run 17 zeta A](bc-108d787a-64b3-5220-99ca-f0f055d3e464) — mis-launched with wrong workspace path; superseded by run 17 fix below.

---

RUN 0 — warm-alpha-ratio / A_COLD / bug_fix
Agent: [EXP-003 run 0 alpha A_COLD](bc-16385854-4ce4-5a89-b096-f02d09362dd3)
Workspace: research/workloads/exp-003-runs/warm-alpha-ratio--A_COLD
Task: Fix computeRatio to return null on zero denominator.
Subagent result: Tests passed yes (1/1 ratio.test.ts). Commit 7069e17. Changed ratio.ts to return null instead of throwing on zero denominator.
Telemetry: SUCCESS wall=35443ms pkg=7169ms git=1938ms bootstrap=9107ms (25.7%) test=738ms read=857ms tools=31 turns=1

RUN 1 — warm-alpha-ratio / B_WARM_PACKAGE / bug_fix
Agent: [EXP-003 run 1 alpha B_WARM](bc-d093793b-5daa-569c-8f02-c89469424e43)
Workspace: research/workloads/exp-003-runs/warm-alpha-ratio--B_WARM_PACKAGE
Task: Fix computeRatio to return null on zero denominator.
Subagent result: Tests passed yes (computeRatio(1,0) returns null). Commit 2f7858e. Same null-return fix in ratio.ts.
Telemetry: SUCCESS wall=44888ms pkg=5896ms git=1621ms bootstrap=7517ms (16.7%) test=1823ms read=791ms tools=31 turns=1

RUN 2 — warm-alpha-ratio / C_WARM_WORKSPACE / bug_fix
Agent: [EXP-003 run 2 alpha C_WARM](bc-32a1d315-640b-5876-86b9-e946df57b12d)
Workspace: research/workloads/exp-003-runs/warm-alpha-ratio--C_WARM_WORKSPACE
Task: Fix computeRatio to return null on zero denominator.
Subagent result: Tests passed yes (1/1 ratio.test.ts; pnpm test exits 1 due to vitest picking up source files). Commit 629b813. Null-return fix in ratio.ts.
Telemetry: SUCCESS wall=51054ms pkg=0ms git=3488ms bootstrap=3488ms (6.8%) test=8747ms read=530ms tools=33 turns=1

RUN 3 — warm-beta-label / B_WARM_PACKAGE / feature_addition
Agent: [EXP-003 run 3 beta B_WARM](bc-f9a038a9-8783-5943-82de-07c3976b6e94)
Workspace: research/workloads/exp-003-runs/warm-beta-label--B_WARM_PACKAGE
Task: Implement formatLabel for [label]: value / bare value formatting.
Subagent result: Tests passed yes (formatLabel test passes; npm test exits 1 due to vitest config). Commit 4680352. Implemented formatLabel in label.ts.
Telemetry: SUCCESS wall=39056ms pkg=6001ms git=2098ms bootstrap=8099ms (20.7%) test=1298ms read=603ms tools=30 turns=1

RUN 4 — warm-beta-label / C_WARM_WORKSPACE / feature_addition
Agent: [EXP-003 run 4 beta C_WARM](bc-79ff47fc-192a-598c-858b-7cfe1f1960df)
Workspace: research/workloads/exp-003-runs/warm-beta-label--C_WARM_WORKSPACE
Task: Implement formatLabel for [label]: value / bare value formatting.
Subagent result: Tests passed yes (1/1 label.test.ts). Commit c569512. Implemented formatLabel in label.ts.
Telemetry: SUCCESS wall=44419ms pkg=0ms git=3730ms bootstrap=3730ms (8.4%) test=3221ms read=502ms tools=32 turns=1

RUN 5 — warm-beta-label / A_COLD / feature_addition
Agent: [EXP-003 run 5 beta A_COLD](bc-0a76e7f9-f38a-5837-9322-faefe2eadfd1)
Workspace: research/workloads/exp-003-runs/warm-beta-label--A_COLD
Task: Implement formatLabel for [label]: value / bare value formatting.
Subagent result: Tests passed yes (1/1 label.test.ts). Commit ef8d2f9. Implemented formatLabel in label.ts.
Telemetry: SUCCESS wall=24345ms pkg=6066ms git=3410ms bootstrap=9476ms (38.9%) test=723ms read=346ms tools=17 turns=1

RUN 6 — warm-gamma-parser / C_WARM_WORKSPACE / refactor
Agent: [EXP-003 run 6 gamma C](bc-9f343041-9e3c-513d-b1b0-e7fe1c3cbd1a)
Workspace: research/workloads/exp-003-runs/warm-gamma-parser--C_WARM_WORKSPACE
Task: Extract parseLine helper without changing parseDocument output.
Subagent result: Tests passed yes (1/1 document.test.ts). Commit 0a008db. Extracted parseLine; parseDocument maps lines through it.
Telemetry: SUCCESS wall=45708ms pkg=4121ms git=3135ms bootstrap=7256ms (15.9%) test=5402ms read=807ms tools=37 turns=1

RUN 7 — warm-gamma-parser / A_COLD / refactor
Agent: [EXP-003 run 7 gamma A](bc-3f09a9c4-500b-51cc-9275-239b6dc40f0f)
Workspace: research/workloads/exp-003-runs/warm-gamma-parser--A_COLD
Task: Extract parseLine helper without changing parseDocument output.
Subagent result: Tests passed yes (1/1 document.test.ts; pnpm test exits 1 due to vitest config). Commit 58e4be5. Extracted parseLine in document.ts.
Telemetry: SUCCESS wall=34832ms pkg=8513ms git=2099ms bootstrap=10612ms (30.5%) test=1010ms read=880ms tools=32 turns=1

RUN 8 — warm-gamma-parser / B_WARM_PACKAGE / refactor
Agent: [EXP-003 run 8 gamma B](bc-04a1691b-9ca0-5a27-b77d-16b6ec1cfec4)
Workspace: research/workloads/exp-003-runs/warm-gamma-parser--B_WARM_PACKAGE
Task: Extract parseLine helper without changing parseDocument output.
Subagent result: Tests passed yes (1/1 document.test.ts). Commit 264c620. Extracted parseLine in document.ts.
Telemetry: SUCCESS wall=57770ms pkg=7960ms git=3094ms bootstrap=11054ms (19.1%) test=1493ms read=1045ms tools=48 turns=1

RUN 9 — warm-delta-slug / A_COLD / test_addition
Agent: [EXP-003 run 9 delta A](bc-f7b963cf-a580-5e17-803f-a1b4ce6dabbb)
Workspace: research/workloads/exp-003-runs/warm-delta-slug--A_COLD
Task: Add slugify edge-case tests (empty input, consecutive separators).
Subagent result: Tests passed yes (3/3 slugify.test.ts). Commit deee018. Added empty-string and consecutive-separator tests; slugify.ts unchanged.
Telemetry: SUCCESS wall=57285ms pkg=9620ms git=2907ms bootstrap=12527ms (21.9%) test=3331ms read=1393ms tools=48 turns=1

RUN 10 — warm-delta-slug / C_WARM_WORKSPACE / test_addition
Agent: [EXP-003 run 10 delta C](bc-2801ccdc-c08b-5961-adce-0c753c777ed0)
Workspace: research/workloads/exp-003-runs/warm-delta-slug--C_WARM_WORKSPACE
Task: Add slugify edge-case tests (empty input, consecutive separators).
Subagent result: Tests passed yes (3/3 slugify.test.ts). Commit fd6e986. Added two edge-case tests; slugify.ts unchanged.
Telemetry: SUCCESS wall=53807ms pkg=1884ms git=3311ms bootstrap=5195ms (9.7%) test=7558ms read=792ms tools=43 turns=1

RUN 11 — warm-delta-slug / B_WARM_PACKAGE / test_addition
Agent: [EXP-003 run 11 delta B](bc-a5abe8ef-be83-5fc2-b3d4-78a239809fc0)
Workspace: research/workloads/exp-003-runs/warm-delta-slug--B_WARM_PACKAGE
Task: Add slugify edge-case tests (empty input, consecutive separators).
Subagent result: Tests passed yes (3/3 slugify.test.ts). Commit 0644510. Added empty-input and consecutive-separator tests; slugify.ts unchanged.
Telemetry: SUCCESS wall=42525ms pkg=7776ms git=3083ms bootstrap=10859ms (25.5%) test=878ms read=891ms tools=36 turns=1

RUN 12 — warm-epsilon-name / B_WARM_PACKAGE / validation_change
Agent: [EXP-003 run 12 epsilon B](bc-834a02a8-0bbc-5645-acc8-81687812e533)
Workspace: research/workloads/exp-003-runs/warm-epsilon-name--B_WARM_PACKAGE
Task: Tighten validateName to reject whitespace-only strings.
Subagent result: Tests passed yes (name.test.ts passes; pnpm test exits non-zero due to vitest config). Commit 460b663. validateName now requires trim().length > 0.
Telemetry: SUCCESS wall=57114ms pkg=8140ms git=8264ms bootstrap=16404ms (28.7%) test=2805ms read=1119ms tools=42 turns=1

RUN 13 — warm-epsilon-name / A_COLD / validation_change
Agent: [EXP-003 run 13 epsilon A](bc-7797e1ba-69d5-5c00-846a-7714f4180144)
Workspace: research/workloads/exp-003-runs/warm-epsilon-name--A_COLD
Task: Tighten validateName to reject whitespace-only strings.
Subagent result: Tests passed yes (1/1 name.test.ts). Commit 8da1f8a. validateName uses trim().length > 0.
Telemetry: SUCCESS wall=75813ms pkg=8153ms git=3605ms bootstrap=11758ms (15.5%) test=1529ms read=1313ms tools=52 turns=1

RUN 14 — warm-epsilon-name / C_WARM_WORKSPACE / validation_change
Agent: [EXP-003 run 14 epsilon C](bc-d187a204-4f01-53d4-aa09-db61b53576b0)
Workspace: research/workloads/exp-003-runs/warm-epsilon-name--C_WARM_WORKSPACE
Task: Tighten validateName to reject whitespace-only strings.
Subagent result: Tests passed yes. Commit 5ee71fc. validateName rejects whitespace-only strings via trim().length > 0.
Telemetry: SUCCESS wall=60980ms pkg=5953ms git=3328ms bootstrap=9281ms (15.2%) test=3054ms read=1008ms tools=51 turns=1

RUN 15 — warm-zeta-record / C_WARM_WORKSPACE / schema_or_contract_change
Agent: [EXP-003 run 15 zeta C](bc-812af43d-589f-57cf-9ca2-a5c2ab2872ee)
Workspace: research/workloads/exp-003-runs/warm-zeta-record--C_WARM_WORKSPACE
Task: Add optional source to RecordShape; update validateRecord.
Subagent result: Tests passed yes (optional source field test). Commit e57bbfd. Extended RecordShape with optional source string.
Telemetry: SUCCESS wall=73542ms pkg=7757ms git=2710ms bootstrap=10467ms (14.2%) test=1530ms read=1098ms tools=48 turns=1

RUN 16 — warm-zeta-record / B_WARM_PACKAGE / schema_or_contract_change
Agent: [EXP-003 run 16 zeta B](bc-a79dc53f-e9fb-5263-bba8-928cf0592653)
Workspace: research/workloads/exp-003-runs/warm-zeta-record--B_WARM_PACKAGE
Task: Add optional source to RecordShape; update validateRecord.
Subagent result: Tests passed no at pnpm test exit (vitest config includes src/**/*.ts); record.test.ts assertion passes. Commit a428d3c. Extended RecordShape with optional source.
Telemetry: SUCCESS wall=86089ms pkg=11235ms git=2987ms bootstrap=14222ms (16.5%) test=4688ms read=1332ms tools=55 turns=1

RUN 17 — warm-zeta-record / A_COLD / schema_or_contract_change
Agent: [EXP-003 run 17 zeta A fix](bc-4c60d240-acd5-5745-9c74-6658ebe43a57)
Workspace: research/workloads/exp-003-runs/warm-zeta-record--A_COLD
Task: Add optional source to RecordShape; update validateRecord.
Subagent result: Tests passed yes (1/1 accepts optional source field). Commit 30cfdac. Extended RecordShape; validateRecord accepts absent or string source.
Telemetry: SUCCESS wall=62850ms pkg=8047ms git=7551ms bootstrap=15598ms (24.8%) test=7194ms read=970ms tools=41 turns=1

---

AGGREGATE SUMMARY

All 18 authoritative runs: SUCCESS (18/18)
Task success rate by condition: A_COLD 6/6, B_WARM_PACKAGE 6/6, C_WARM_WORKSPACE 6/6

Median wall-clock by condition:
A_COLD: 46364ms
B_WARM_PACKAGE: 51001ms
C_WARM_WORKSPACE: 52431ms

Median package_manager ms by condition:
A_COLD: 8100ms
B_WARM_PACKAGE: 7868ms
C_WARM_WORKSPACE: 3003ms

Median bootstrap (pkg+git) share by condition:
A_COLD: 25.3%
B_WARM_PACKAGE: 19.9%
C_WARM_WORKSPACE: 11.9%

Cross-run conclusion: Warm workspace cuts package_manager time roughly in half and bootstrap share from ~25% to ~12%, but total wall-clock does not drop — time shifts to test/read/exploration. Decision REPLICATE: borderline between kill (<10%) and strong signal (>=20%).

ARTIFACTS
research/results/exp-003/subagent-compiled-report.md (this file)
research/results/exp-003/run-manifest.json
research/results/exp-003/raw.jsonl
research/results/exp-003/transcripts/ (18 transcripts + checksums)
