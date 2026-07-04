# JaKomo — Language Learning App

JaKomo is a mobile-first language learning platform designed to help adult English speakers learn Mexican Spanish with higher efficiency than traditional apps. Instead of generic lesson paths, JaKomo builds a personalized learning plan around each user's real goal — whether that's an upcoming trip to Mexico, reconnecting with family, or finally finishing what they started years ago.

---

## What makes it different

Most language apps optimize for daily streaks and gamification. JaKomo optimizes for **real-world confidence**. The coaching engine adapts to each learner's pace, motivation signals, and skill profile — and pairs them with peers for structured conversation practice, not just solo drilling.

---

## Target user

Adult professionals with a travel or personal motivation goal, primarily US-based English speakers learning Mexican Spanish. Two primary segments:

- **Booked traveler** — has a trip planned, needs practical and time-pressured focus
- **Aspirational traveler** — motivated but needs scaffolding to stay consistent

---

## Core features

- **Personalized learning plan** — generated from onboarding, updated weekly and on key signals
- **CEFR-based level calibration** — tracked across listening, speaking, vocabulary, and grammar separately; communicated to users in plain language
- **Peer matching** — synchronous conversation sessions with matched learners based on level, goals, region interest, schedule, and complementary skill gaps
- **AI coaching layer** — warm first-person coaching voice that adapts the plan based on progress, motivation dips, usage patterns, and session debriefs
- **Scenario-based sessions** — structured conversation cards with contextual hints (vocabulary, grammar, cultural context, regional variation)
- **Grammar vs. speaking priority** — users set their learning priority at onboarding; lesson mix reflects it

---

## Language scope

**Mexican Spanish only at launch.** CEFR leveling and grammar calibration are dialect-agnostic internally; Mexican Spanish specificity lives in content tags, cultural database, and resource metadata. Additional regions (Spain, Argentina) are additive later without requiring a rebuild.

---

## Architecture overview

| Layer | Approach |
|---|---|
| Lesson recommendations | Structured resource library with CEFR metadata |
| Communication & edge cases | LLM (hybrid model) |
| Plan updates | Weekly scheduled + event-driven |
| Peer matching | Algorithm-based, manually curated during beta |
| Cultural content | Expert-reviewed database, organized by country/region |

---

## Persona types (internal)

Users are scored across four behavioral archetypes at onboarding — not assigned a single label, but weighted across all four to shape coaching tone, lesson mix, and matching defaults:

- **Social Striver** — motivated by connection and conversation, needs accountability
- **Time-Starved Optimist** — high intent, inconsistent time, needs micro-goals and easy re-entry
- **Confidence-Constrained Beginner** — avoids speaking, needs low-pressure environments and reassurance
- **Purpose-Driven Returner** — lapsed learner with prior experience, needs fast confidence wins

---

## Beta strategy

- Constrained beta with existing test group before public launch
- Matches curated manually during beta, algorithm relaxed as user base grows
- Solo content available immediately while waiting for a peer match
- Success metrics defined before looking at data — segmented between target and non-target users

---

## Status

🚧 In development — repository initialized June 2026.

---

## Project structure

```
/onboarding        Onboarding flow, level calibration, persona scoring
/coaching          AI coaching engine, plan generation, adaptation logic
/peer-matching     Matching algorithm, session management, debrief pipeline
/resources         Resource library, CEFR metadata, content tagging
/cultural-content  Cultural norms database, language deployment wiki
```

---

## Deferred for later

- Business model
- Cultural wiki (pending reviewer compensation plan)
- AI conversation practice mode
- Language exchange model (English ↔ Spanish native pairing)
- Local peer matching (when city-level density exists)
- Community contributions to resource library
