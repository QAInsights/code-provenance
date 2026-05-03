## How IBM Bob Was Used to Build the Code Provenance System

**IBM Bob was central to every phase of this project from the first spark of an idea to the final packaged VS Code extension.**

### 1. Brainstorming & Concept Definition

The project began with a straightforward question that I fed into Bob: *"How do we know if AI-generated code is compliant with HIPAA, GDPR, or PCI-DSS? What if we could track where every line of code came from, who wrote it, and what model was used? Something like Git commit hash but for AI-generated code."* 

Through multiple back-and-forth turns, Bob helped shape the core framing  *"Git blame for AI-generated code"* and expanded that seed into a structured problem statement with real-world impact scenarios across healthcare, finance, and privacy regulations. 

The three-stage enforcement model (1. Capture → 2. Warn → 3. Gate) emerged directly from those early conversations.

### 2. Architecture Design & Initial Boilerplate

Once the concept was clear, a basic boilerplate was written by hand and handed to Bob for enhancement. Bob elevated it into a proper layered architecture: a **Provenance Capture Layer**, a **Git Attributes Storage** backend, a **Validation Engine**, and an **Audit Dashboard**. 

Bob also defined the structured metadata schema capturing model name, prompt hash, confidence score, compliance flags, and cryptographic chain hashes which became the contract the entire codebase was built against.

### 3. Iterative Feature Development

Bob drove multiple implementation iterations:
- **[BobSessionWatcher.ts](cci:7://file:///c:/Users/Navee/gits/code-provenance/src/core/BobSessionWatcher.ts:0:0-0:0)**  Bob helped design the session watcher. 
- **[AIBehaviorDetector.ts](cci:7://file:///c:/Users/Navee/gits/code-provenance/src/core/AIBehaviorDetector.ts:0:0-0:0)**  Bob contributed to the behavioral engine that detects AI-generated code in real time by analyzing insertion speed, block size, tab-completion patterns, and structured code signatures  classifying each detection with a confidence score.
- **`ProvenanceStore.ts` and `GitAttributesStore.ts`**  Bob helped structure the storage layer so provenance metadata is embedded directly into source files and stored version-controlled alongside the code.

### 4. The Pivot  Handling the Missing Bob API

A significant roadblock emerged mid-development: the Bob API was not accessible. Rather than blocking progress, we pivoted to a **forensics-first approach**. Bob itself helped reason through the pivot: instead of pulling provenance data using the API after the fact, the system would *detect AI code in real time through behavioral analysis*.

The [BobApiClient.ts](cci:7://file:///c:/Users/Navee/gits/code-provenance/src/api/BobApiClient.ts:0:0-0:0) was built and retained as a forward-compatible integration layer, ready to activate when the API becomes available, while the behavioral detector and session watcher served as the working fallback. 

The `.gitattributes` mechanism was adopted on Bob's suggestion as a tamper-evident, version-controlled storage format that requires no external database.

### 5. Refinements, Fixes & Packaging

In the final stretch, Bob helped with targeted fixes refining the confidence scoring algorithm in [AIBehaviorDetector](cci:2://file:///c:/Users/Navee/gits/code-provenance/src/core/AIBehaviorDetector.ts:14:0-348:1), improving compliance flag detection patterns (HIPAA, PCI-DSS, GDPR, SOX keyword matching), cleaning up module boundaries, and ensuring the extension's [package.json](cci:1://file:///c:/Users/Navee/gits/code-provenance/src/api/BobApiClient.ts:232:12-232:46) was correctly structured for VS Code marketplace packaging. 

The resulting `.vsix` artifact (`code-provenance-0.1.0.vsix`) was assembled with Bob's guidance on the build configuration.

---

**In summary:** Bob participated as an active co-developer across every stage of the project: ideation, architecture, implementation, problem-solving around the API roadblock, and final packaging. The project is not only *about* tracking AI-generated code; it was itself substantially built with one.