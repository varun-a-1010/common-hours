---
type: Reference
title: Devpost copy
description: Submission text for the Qloo Agentic Hackathon.
timestamp: 2026-10-31
---

**Tagline:** Because nobody has ever said, "I can't wait for mandatory fun."

## Inspiration

Every team event in history has been planned the same way. Someone is told to "organize something fun." This person has a real job. They book whatever has parking. Three weeks later, eleven adults are standing in a bowling alley, in rented shoes, discussing the quarterly roadmap.

Asking the group doesn't help. You send a poll, four people answer, and the plan is then determined by whichever colleague feels most strongly about axe throwing.

## What it does

Common Hours collects what people actually want and what they actually need, then proposes complete events: activity, food and timing, inside the budget. It handles the unglamorous parts that decide whether an event happens at all, like locked bookings, dietary and access requirements, share links, agendas, and feedback, so the next event is not a repeat of the bowling incident.

Qloo adds evidence on how each venue fits the group, person by person, so "Who is represented?" has an answer other than "Dave, mostly."

## Why Qloo is essential

Preferences tell you what people say they like. Everybody says they like "good food" and "something chill." Qloo links the specific things people love to real venues in the event's city, and shows who each option represents and why, so a plan can be compared on more than price and distance.

## How we built it

- **Planner:** a deterministic engine assembles whole-event plans and filters them against budget (with a 10% reserve), headcount, timing, requirements and recent events, so you don't get pottery twice. Plans come with reasons in plain English.
- **Replanning:** lock what's already arranged and plan around it. Each revision shows what changed, what stayed, what it costs, and which completed checks carry over.
- **Qloo:** the organizer searches and explicitly confirms each favourite, since "Dune" is several things. City-scoped `/v2/insights` queries use real category IDs with no silent fallback to some other city, then feasible venues are compared per person, in bounded calls with cache reuse. Missing evidence stays visible as unknown instead of being treated as a score.
- **Privacy:** only selected reference IDs, venue IDs, search text and the city reach Qloo. Names, dietary needs and private notes never leave the app, and participant links cannot touch the discovery routes.
- **Stack:** TypeScript, Fastify and React.

## Challenges

The strongest temptation was to let taste data fill in the blanks. It's right there, and it would look great. But nothing in a taste graph tells you whether a venue has a ramp or can feed a vegan, and a wrong guess there ruins someone's afternoon. So capacity, price, diet and access are never imported from taste data. A person enters them, or they stay unknown.

## What's next

Calendar availability, real venue quotes, and an agent that can run the whole planning loop for an organizer.

## Limits

Qloo shows cultural association, not whether anyone will attend or enjoy an event. Sample activities and prices are illustrative. We cannot make Greg come.
