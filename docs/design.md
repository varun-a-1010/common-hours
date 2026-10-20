---
type: Decision
title: Design direction
description: A calm blue planning studio with a distinctive shared timetable.
timestamp: 2026-10-17
---

# Design direction

Working name: Common Hours. Make shared time feel considered and easy to organize.

Palette: cloud #f5f7fc, paper #ffffff, ink #253252, cobalt #334bd3,
periwinkle #e5eaff, leaf #527a58. Small amber accents communicate pending checks.
Type: Manrope for headings, locally served DM Sans for body and controls.
Layout: narrow workspace sidebar; wide planning surface with the event's actual
title and a useful horizontal event summary; timetable on the left, confirmations
and budget on the right. Left-aligned, generous white space, no marketing hero
inside the workspace. The memorable visual is the colored, editable event agenda.

Review: generic dashboard statistics and repeating card grids would obscure the
planning task. Use a purposeful agenda, compact lists and distinct comparison
columns only where the information warrants comparison. No decorative gradients,
stock photos, fabricated testimonials, or unnecessary animation. Mobile navigation
collapses into a clear header. Keyboard focus and reduced-motion preferences matter.

Browser/visual QA is reserved for Varun under the fleet instructions.

The comparison additions use compact, expandable evidence rows on plan options and
the agenda. They separate direct stated interests from inferred cultural affinity.
Revision rows show exactly what changed and which completed checks carry over;
blue and green labels supplement text rather than carrying meaning alone.

Implementation patterns reviewed (public source, not end-to-end demo verification):
[Common Bill revisions](https://github.com/Ananya6Daitkar/common-bill/blob/f115474dbae88b1a9972d3783a0a0f3885ac53a3/lib/revision.ts),
[Common Ground group ranking](https://github.com/G-ojies/common-ground/blob/20fcb294afb216c342ee15e09ba051d581c0f159/src/lib/group-rank.ts),
and [Theme Night GM partial revisions](https://github.com/ZNLong2203/Theme-Night-GM/blob/d46abf5638868624da31b1bda93bbf005b4e8711/src/lib/agent/revise.ts).
Common Hours implements its own constraint-first comparison and revision logic.
Missing data stays unknown; no arbitrary enjoyment bands or satisfaction percentages.
