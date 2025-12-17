# Code Specialist Help Request: Regex Pattern for Crammed Content Splitting

## System Environment
- **Platform**: React Native mobile app (iOS-optimized)
- **Framework**: Expo SDK 53 with React Native 0.76.7
- **Language**: TypeScript
- **Styling**: Nativewind (TailwindCSS for React Native)
- **Package Manager**: bun
- **AI Model**: OpenAI GPT-4o for generating step-by-step homework solutions

## Problem Description

We have a homework helper app where an AI (GPT-4o) generates step-by-step solutions to math problems. The AI returns JSON with solution steps, and we post-process the content to fix formatting issues. Despite multiple attempts, we have a **persistent cramming issue** where the AI ignores line break instructions and outputs everything on one continuous line.

## Current Issue (Screenshot Evidence)

The equation display shows:
```
Start with the equation: x + ½y = -1 Add 4x to both sides: ½y = 4x -4
- 1 Multiply every term by 2 to solve for y: → y = 8x - 2
```

**What it SHOULD look like:**
```
Start with the equation:
-4x + ½y = -1

Add 4x to both sides:
½y = 4x - 1

Multiply every term by 2 to solve for y:
y = 8x - 2

→ y = 8x - 2
```

## Root Cause

The AI is generating JSON where the `equation` field contains ONE CONTINUOUS STRING with no newlines:
```json
"equation": "Start with the equation: -4x + 1/2y = -1 Add 4x to both sides: 1/2y = 4x - 1 Multiply every term by 2 to solve for y: y = 8x - 2"
```

This creates text wrapping chaos where words split at random screen-width boundaries.

## Code Architecture

**File: `src/utils/contentFormatter.ts`** - Main formatting pipeline

The `formatAIContent()` function processes AI-generated content through multiple stages:
1. **STEP -2**: Emergency crammed content fix (lines 245-286)
2. **STEP -1**: Force line breaks between list items (line 291)
3. **STEP 0-0.9**: Clean LaTeX, fix fractions, fix unclosed notation (lines 293-332)
4. **STEP 1**: Mask sensitive tokens (color tags, fractions, subscripts) (lines 362-366)
5. **STEP 2**: Smart line break management (lines 368-416)
6. **STEP 3**: Unmask tokens (line 429)
7. **STEP FINAL**: Convert LIST_BREAK markers to newlines (line 433)

## Current Fix Attempt (Not Working)

```typescript
// STEP -2: Lines 245-286 in src/utils/contentFormatter.ts

// Step 1: Find "Original equation:" or "Start with:" followed by ANYTHING, then capital instruction
result = result.replace(
  /(Original equation|Start(?:ing)? with):\s*([^]+?)\s+(Add|Subtract|Multiply|Divide|Simplify|Combine|Factor|Expand|Distribute|Solve|Rearrange|Isolate|Cross|Graph)/gi,
  (match, prefix, equation, instruction) => {
    // Only split if equation part is reasonably short (not a whole paragraph)
    if (equation.length < 100) {
      return `${prefix}:\n${equation.trim()}\n\n${instruction}`;
    }
    return match;
  }
);

// Step 2: CRITICAL - Detect instruction phrases crammed together
// Pattern: "[Instruction word] [stuff including colon] [equation/work] [Next Instruction word]"
// Example: "Add 4x to both sides: 1/2y = 4x - 1 Multiply every term"
result = result.replace(
  /(Add|Subtract|Multiply|Divide|Simplify|Combine|Factor|Expand|Distribute|Solve|Rearrange|Isolate|Cross|Graph)([^:\n]{0,60}?):\s*([^]+?)\s+(Add|Subtract|Multiply|Divide|Simplify|Combine|Factor|Expand|Distribute|Solve|Rearrange|Isolate|Cross|Graph)/g,
  (match, inst1, suffix1, middle, inst2) => {
    // Only split if middle part is not too long (avoid false positives)
    if (middle.length < 150) {
      return `${inst1}${suffix1}:\n${middle.trim()}\n\n${inst2}`;
    }
    return match;
  }
);

// Step 3: EMERGENCY - Split on "from both sides:" or "every term by" patterns
result = result.replace(
  /(from both sides|every term by|both sides by|to both sides):\s*([^\n]+?)\s+(Add|Subtract|Multiply|Divide|Simplify|Combine|Factor|Expand|Distribute|Solve)/gi,
  '$1:\n$2\n\n$3'
);
```

## Failed Attempts History

1. **Attempt 1**: Basic pattern matching with `[^A-Z]+?` - Failed because it stopped matching too early on equations with spaces/operators
2. **Attempt 2**: Added length limits (50-100 chars) - Failed because actual equations exceeded these limits
3. **Attempt 3**: Changed to `[^]+?` (match ANY character) - Still failing as shown in screenshot
4. **Attempt 4**: Added callback functions with length validation - Still not catching all cases
5. **Attempt 5**: Added specific phrase patterns ("from both sides", "every term by") - Still incomplete

## Detailed Test Case

**Input string (what AI actually generates):**
```
"Start with the equation: -4x + 1/2y = -1 Add 4x to both sides: 1/2y = 4x - 1 Multiply every term by 2 to solve for y: y = 8x - 2"
```

**Expected output after formatting:**
```
Start with the equation:
-4x + 1/2y = -1

Add 4x to both sides:
1/2y = 4x - 1

Multiply every term by 2 to solve for y:
y = 8x - 2
```

**What's ACTUALLY happening (from screenshot):**
```
Start with the equation: x + ½y = -1 Add 4x to both sides: ½y = 4x -4
- 1 Multiply every term by 2 to solve for y: → y = 8x - 2
```

Notice:
- "Start with the equation:" has no line break after it
- "-4" appears orphaned on a separate line (the "-4" from "-4x" split)
- "- 1" appears separately (the "- 1" from "4x - 1" split)
- Instructions are crammed together

## Why Current Regex Is Failing

Looking at the screenshot evidence, the patterns are NOT matching correctly:

### Pattern 1 Analysis
```typescript
/(Original equation|Start(?:ing)? with):\s*([^]+?)\s+(Add|Subtract|...)/gi
```
- This SHOULD match "Start with the equation: -4x + 1/2y = -1 Add 4x"
- The `([^]+?)` should capture "-4x + 1/2y = -1"
- But it's NOT working - the text still shows cramming

### Pattern 2 Analysis
```typescript
/(Add|Subtract|...)([^:\n]{0,60}?):\s*([^]+?)\s+(Add|Subtract|...)/g
```
- This SHOULD match "Add 4x to both sides: 1/2y = 4x - 1 Multiply every term"
- The middle section `([^]+?)` should capture "1/2y = 4x - 1"
- But it's NOT working - still showing cramped text

### Hypotheses for Failure

1. **Special characters breaking regex**: Fractions `1/2`, negative signs `-4x`, operators `+`, `/` might be interfering
2. **Non-greedy `[^]+?` stopping too early**: Might be stopping at first space before instruction keyword
3. **Length checks preventing splits**: The `if (equation.length < 100)` and `if (middle.length < 150)` might be rejecting valid matches
4. **Case sensitivity issues**: Some instruction words might be lowercase
5. **Multiple instructions in sequence**: Pattern 2 might only catch first pair, missing subsequent cramming
6. **Equation formatting**: The AI might be using `{1/2}` syntax or `½` unicode which the pattern doesn't handle

## Additional Context

### Special Syntax Used
- **Fractions**: `{1/2}` displays as vertical fraction ½
- **Variables**: `*x*` renders as italic *x*
- **Subscripts**: `_helium_` renders as subscript
- **Superscripts**: `^2^` renders as superscript
- **Color highlighting**: `[red:answer]` for results, `[blue:value]` for references
- **Arrows**: `→` used to indicate final answers

### Processing Order
1. STEP -2 (crammed content fix) runs FIRST on raw AI output
2. Then other steps handle LaTeX cleanup, fraction fixing, masking
3. The formatter can't rely on fraction syntax being `{1/2}` vs `1/2` at this stage

### Performance Constraints
- Must be performant (runs on every solution display)
- Runs on mobile devices (React Native)
- Typical input: 200-1000 characters
- Must complete in < 100ms

## Question for Code Specialist

**What regex patterns or alternative string processing approach would reliably detect and split these crammed algebra instructions?**

### Requirements:
1. Must handle equations with mixed content (variables, operators, fractions, negative numbers, spaces)
2. Must work when instructions have or don't have consistent patterns
3. Must work on ONE continuous string with no existing newlines
4. Must avoid false positives (don't split mid-equation or mid-instruction)
5. Must handle multiple instructions crammed in sequence (not just pairs)
6. Must work in TypeScript/JavaScript regex engine
7. Should handle edge cases: very short equations, equations with no operators, special unicode characters

### Specific Questions:
1. Why is `([^]+?)` non-greedy quantifier not working as expected?
2. Should we use multiple passes instead of trying to catch everything in one regex?
3. Should we abandon regex entirely for a character-by-character parser?
4. Are there TypeScript regex flags or features we're not using that could help?
5. Would splitting by instruction keywords FIRST, then reconstructing, be more reliable?

## Complete Current Code Section

```typescript
// File: src/utils/contentFormatter.ts
// Lines 245-286

// STEP -2: NUCLEAR FIX FOR CRAMMED CONTENT
// AI sometimes completely ignores line break instructions and crams everything together
// This creates output like: "Original equation: 5x - 6y = 36 Subtract 5x from both sides: -6y = -5x + 36"
// We need AGGRESSIVE pattern matching to detect and fix this

// ULTRA-AGGRESSIVE APPROACH: Split on ANY capital letter instruction word
// This catches ALL cramming cases, not just specific patterns

// Step 1: Find "Original equation:" or "Start with:" followed by ANYTHING, then capital instruction
// More flexible pattern that catches equations with spaces, operators, numbers
result = result.replace(
  /(Original equation|Start(?:ing)? with):\s*([^]+?)\s+(Add|Subtract|Multiply|Divide|Simplify|Combine|Factor|Expand|Distribute|Solve|Rearrange|Isolate|Cross|Graph)/gi,
  (match, prefix, equation, instruction) => {
    // Only split if equation part is reasonably short (not a whole paragraph)
    if (equation.length < 100) {
      return `${prefix}:\n${equation.trim()}\n\n${instruction}`;
    }
    return match;
  }
);

// Step 2: CRITICAL - Detect instruction phrases crammed together
// Pattern: "[Instruction word] [stuff including colon] [equation/work] [Next Instruction word]"
// Example: "Add 4x to both sides: 1/2y = 4x - 1 Multiply every term"
// This is the MOST COMMON cramming pattern
result = result.replace(
  /(Add|Subtract|Multiply|Divide|Simplify|Combine|Factor|Expand|Distribute|Solve|Rearrange|Isolate|Cross|Graph)([^:\n]{0,60}?):\s*([^]+?)\s+(Add|Subtract|Multiply|Divide|Simplify|Combine|Factor|Expand|Distribute|Solve|Rearrange|Isolate|Cross|Graph)/g,
  (match, inst1, suffix1, middle, inst2) => {
    // Only split if middle part is not too long (avoid false positives)
    if (middle.length < 150) {
      return `${inst1}${suffix1}:\n${middle.trim()}\n\n${inst2}`;
    }
    return match;
  }
);

// Step 3: EMERGENCY - Split on "from both sides:" or "every term by" patterns
// These are VERY common in algebra and almost always should have line breaks after
result = result.replace(
  /(from both sides|every term by|both sides by|to both sides):\s*([^\n]+?)\s+(Add|Subtract|Multiply|Divide|Simplify|Combine|Factor|Expand|Distribute|Solve)/gi,
  '$1:\n$2\n\n$3'
);
```

## Alternative Approaches to Consider

1. **Multiple sequential passes** instead of complex single regex
2. **Token-based parsing** - split by instruction keywords first, then reconstruct
3. **State machine parser** - track whether we're in instruction vs equation
4. **Lookahead/lookbehind** - use advanced regex features
5. **String.split() with reconstruction** - split on instruction words, add formatting
6. **Character-by-character parsing** - more control but slower

## Success Criteria

The solution must successfully transform this input:
```
"Start with the equation: -4x + 1/2y = -1 Add 4x to both sides: 1/2y = 4x - 1 Multiply every term by 2 to solve for y: y = 8x - 2"
```

Into this output:
```
Start with the equation:
-4x + 1/2y = -1

Add 4x to both sides:
1/2y = 4x - 1

Multiply every term by 2 to solve for y:
y = 8x - 2
```

And handle variations like:
- Different instruction words (Simplify, Combine, Factor, etc.)
- Different equation complexity (longer/shorter)
- Different number of steps (2-10 instructions)
- Edge cases (no colon after instruction, lowercase instruction, etc.)

---

## Request

Please provide:
1. A working regex pattern(s) or alternative solution
2. Explanation of why current approach fails
3. TypeScript code snippet that can replace lines 245-286
4. Test cases demonstrating the solution works
5. Performance considerations for mobile environment

Thank you for your help!