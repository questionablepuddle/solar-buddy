# Writing your own quest

A quest is one JSON file in this folder. Point the buddy at it with the
`solarBuddy.quest` setting (use the file name without `.json`), or run
**Solar Buddy: Choose a quest**.

```jsonc
{
  "title": "Build a trading-pattern bot",   // shown at the top of the card
  "about": "one sentence of framing",        // optional
  "steps": [
    {
      "title": "Pick one precise question",   // required — the heading
      "what":  "the concrete action to take", // the main instruction
      "why":   "why this step matters",        // optional, shown muted
      "hint":  "a nudge if they're stuck",     // optional, shown in the yellow box
      "say":   "what Sprout says out loud"     // optional; defaults to the title
    }
  ]
}
```

Only `title` (on the quest) and `title` (on each step) are required; everything
else is optional. The buddy walks the steps in order and remembers your place
per project. Make one for whatever you're building next — a website, a Discord
bot, a game — and the coaching comes for free.
