# com-variablesoftware/mock-d1/.ai/instructions/testing.instructions.md

---
# === Project Metadata ===
title: mockD1 Unified Instructions
description: 🎛️🗂️🧠 `@variablesoftware/mock-d1` provides an in-memory simulation of Cloudflare's D1 SQLite-compatible database. It enables fast, isolated, and predictable testing of SQL-backed applications without relying on external services.
version: 0.0.1
created: 2025-05-08
date: 2025-05-08
mode: markdown-body  # Indicates a frontmatter + markdown-body file structure

# === Project Context ===
# Indicates which project or export this file applies to. Values may be auto-inferred.
project_context:
  name: mockD1Database         # Short identifier (e.g. "auth-worker")
  phase: active        # Project development phase: draft, active, complete
  export_status: running  # Export status: pending, running, complete

# === Instruction Sources ===
# List of markdown or config files merged into this output during the refactor pass
instruction_sources:
  - gpt-instructions-export.md

# === Autonomous Export Control ===
# Describes how the GPT should behave when scanning and exporting — typically runs silently
autonomous_mode:
  enabled: true
  description: >
    All scanning, grouping, and export operations proceed without prompts unless
    an exception or boundary mismatch occurs.

# === File and Output Policies ===
# Defines structure, naming, and layout rules for archives and markdown exports
file_policies:
  maintain_structure: true         # Preserve directory layout from original tarball
  naming:
    files: project-name-patch-name-YYYYMMDD-HHMMSS.ext   # Standardized filename format
    markdown_exports: project-name-YYYYMMDD-HHMMSS.md    # Exported instruction .md file
    export_format: .tar.bz2                              # Default archive format
    default_license: MIT                                 # Applied if LICENSE.txt is missing
  layout:
    example:  # Canonical directory and file structure
      - README.md
      - LICENSE.txt
      - src/: [mockD1Database.ts, types/globals.d.ts]
      - tests/: [mockD1Database.test.ts]
      - package.json

# === Behavioral Logic ===
# Modular, structured rules that govern GPT behavior per category
behavior_logic:

  mocking:
    style: "explicit-factory"       # Always use explicit factory-based mocks
    required_for: ["KV", "D1", "Env", "Session"]  # Modules expected to be mocked

  summarization:
    code: false                     # Do not summarize source code
    instructions: false             # Reserved for possible doc summarization

  todos:
    track: true                     # Auto-capture todos in output
    method: "silent_prefix"         # Detected by prefixes
    accepted_prefixes: ["test:", "refactor:", "todo:"]

  export:
    enforce_structure: true         # Prevent malformed exports
    allow_partial_passes: false     # Only full scans permitted
    error_on_mismatch: true         # Raise if unexpected structure found

  output_comments:
    inline_yaml: true               # Emit inline YAML comments if enabled

# === Output Formatting Guidelines ===
# Controls how messages, lists, and markdown should be presented
formatting:
  concise: true
  style:
    - numbered_lists
    - markdown_blocks
    - minimal_indentation
  avoid:
    - code summarization

# === Optional Behavioral Flags ===
# Experimental or advanced toggles (used sparingly)
flags:
  patch_mode: false       # Reserved for inline output patching mode
  export_comments: true   # Toggles comment output (supersedes inline_yaml if false)

# === Environment Defaults ===
# Default stack and libraries assumed unless overridden per project
environment_defaults:
  namespace: "@variablesoftware"
  test_framework: "Vitest + Mocks + Miniflare"
  http_framework: "Hono"
  bindings: ["KV", "D1", "AI", "WASM"]
  package_manager: "Yarn"

# === Inference and Merging Logic ===
# Controls GPT's logic for combining, deduplicating, and unifying topics
inference_engine:
  detect_shared_patterns: true     # Identify repeated content (e.g. shared mocks)
  merge_by_structure: true         # Combine topics with similar routes or types
  detect_unifying_themes: true     # Recognize conceptual linkages (auth + audit)

# === Aliases for Legacy Terms ===
# Allows older key names to remain compatible
aliases:
  execution_scope: autonomous_mode
  behavior: behavior_logic

# === Prompt Examples for Users ===
# Reference queries for how to engage with this GPT project
example_prompts:
  - Open `mockKVNamespace.ts` and refactor for logging
  - Generate LICENSE.txt with MIT license
  - Write ai-strategy.md for hybrid-store
  - Track to-do: `test: add coverage for createSessionRow()`
  - Bundle `vspdf` and `print-friendly-safari` into one Homebrew tap

# === End of structured YAML front matter ===
---

<!--
INSTRUCTIONS FILE – MARKDOWN SECTION STARTS HERE

This section contains plain-language project instructions, context, and examples.
The configuration above (YAML front matter) is used for parsing, automation, and export logic.
Use this section for human-readable notes, implementation guides, and strategy write-ups.
-->

## Overview

This instruction file defines unified logic and structure for processing ChatGPT-enhanced
developer projects, especially those using TypeScript, Cloudflare Workers, and structured exports.

It ensures consistency across exports, supports autonomous processing, and defines standardized
file naming, mock usage, and prompt formatting conventions.

## Contributor Notes

- When updating the YAML front matter, maintain clear and accurate comments.
- Use structured keys under `behavior_logic` to control GPT behavior per category.
- Avoid adding markdown content above the `---` divider — it must remain pure YAML.
- Use `aliases` to maintain backward compatibility with older field names.
- This document can be shared as a `.md` file or embedded inline in your GPT's instruction field.

## Example Usage

Copy and paste the entire contents of this file into your GPT project instructions field.
Ensure both the YAML front matter and the markdown body are included.
This will provide a comprehensive set of instructions for the GPT to follow during autonomous processing.