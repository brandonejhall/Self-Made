# Self Made: Concept (source of truth, do not reinterpret)

- **Working title:** Self Made
- **One-sentence pitch:** Start at 21 with $2,000, a phone and a rented room, and build a life into a world-scale dynasty over 60 years, from scrub to the richest person on Earth.
- **Player role:** One person, then a founder, then the head of a dynasty. When the player dies, play continues as a chosen heir.
- **Core fantasy:** Every dollar of the empire traces back to a decision you made, and every shortcut you took comes back years later.
- **Platform:** Static web app, mobile-first, deployed to Cloudflare Pages. Save state in localStorage. No backend.

## Starting cities

Kingston, Lagos, São Paulo, Manila, Detroit, Naples. Each city sets cost of living, access to credit, passport mobility, disaster risk and informal pressure. Details in `LORE.md`.

## Three stages, one continuous life

1. **Hustle (age 21 to 30).** Life-sim scale. Energy, cash, reputation, relationships. Side work, first loan, first asset. One turn = one week.
2. **Operator (age 30 to 50).** Business scale. Own companies in any sector. Hire managers who run things. Expand to a second city, then a second country, on a world map of 30 economies. One turn = one month.
3. **Dynasty (age 50 onward).** World scale. Billion-dollar entities, governments, regulators, heirs. On death, continue as one heir. One turn = one quarter.

## Design pillars

1. **Consequences never reset.** Decisions write to a permanent history. Shortcuts and betrayals resurface years later as events.
2. **The world reacts to your size.** Each wealth tier unlocks new levers and new enemies (see `LORE.md`, Wealth tiers).
3. **Delegation is progression.** Early you do everything yourself. Later you hire people, and they can fail or betray you. The player's weekly hours stay fixed at 100.

## Loops

- **30-second loop:** Allocate the week's hours, resolve 1 to 3 situations, see cash and stats move.
- **10-minute loop:** Reach the next milestone: a first business, a first property, the next tier.
- **Multi-session loop:** Tier climb, mysteries unfolding on the world clock, succession.

## Consequence model

Every decision appends to the player's history log with tags (for example `cut_out_partner`, `cash_deal_shady`). Delayed events in `/content` declare which tags and conditions trigger them and how many years later.

## Vertical slice

Stage 1 only, one city (Kingston), 9 in-game years (468 weekly turns, compressed by auto-advance), phone UI, 40 events, the grandmother's shoebox, first partner, first loan. Ship nothing else until this loop is fun.

**Balance target:** In headless runs, the median competent strategy reaches $1M between age 27 and 32. A greedy strategy reaches it faster but triggers at least 1 major delayed consequence. A passive strategy stays under $50K.
