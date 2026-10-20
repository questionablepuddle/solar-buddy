# Solar Buddy 🌱

A little solarpunk seedling named **Sprout** who lives in your VS Code sidebar. When your
code has errors, she concentrates, *multiplies* so there's one of her per error, and runs
across your actual error lines to perch on each one. When your code is clean, she coaches
you through a project one step at a time.

This repo is built to be **read and extended**, not just installed. It's small on purpose.
By the end of the "Your turn" lessons you'll understand how VS Code extensions actually
work — and you'll have made Sprout your own.

---

## First, an honest word about what's possible

You might picture Sprout literally swinging across the letters *inside* your code editor.
Here's the real deal: **VS Code does not let an extension draw animated graphics on top of
the text editor.** The editor isn't a canvas. Extensions get two tools:

1. **Decorations** — small markers glued to a line: a gutter icon, a highlight, a bit of
   text after a line. This is how Sprout puts a bud in the gutter *on your real error lines*.
2. **Webviews** — a full web page, but it lives in its own panel and *can't* overlap the editor.

So Solar Buddy uses both, honestly: the rich animation (running, multiplying, concentrating)
happens in a **webview panel** that shows a strip of your real error-line code for Sprout to
run across, and a lightweight **gutter marker** hops onto the matching lines in the editor.
That combo is the true ceiling of the platform — and once you accept it, you're designing
with the real VS Code instead of fighting it. Everything you learn here is transferable.

---

## Run it in 60 seconds

You need [VS Code](https://code.visualstudio.com/) and [Node.js](https://nodejs.org/) installed.

1. Open this folder in VS Code (`File → Open Folder…`).
2. Press **F5**. (If VS Code asks, pick *"VS Code Extension Development"*.) A second VS Code
   window opens — the **Extension Development Host** — with Solar Buddy loaded. This second
   window is your test lab; the first one is where you edit the code.
3. In that new window, click the 🌱 leaf in the activity bar (far left) to open Sprout.
4. Open any code file. Make a deliberate mistake (delete a bracket). Watch Sprout react.

> No F5? You can also create `.vscode/launch.json` with the snippet at the bottom of this
> file, or run the logic tests with no VS Code at all: **`npm test`**.

Change code in the first window, then press **⌘R / Ctrl-R** in the Host window to reload it.
That edit-reload loop is 90% of extension development.

---

## The map — every file, and what it's for

```
solar-buddy/
├── package.json         WHAT the extension adds to VS Code (declared as data)
├── src/
│   ├── extension.js     the VS Code side: listens to the editor, talks to the panel
│   └── logic.js         the brain: plain functions, no VS Code — the testable part
├── media/
│   ├── stage.html       the panel's web page (Sprout's world)
│   ├── stage.css        how that world looks (the solarpunk palette lives up top)
│   ├── stage.js         how Sprout moves (start at render(); it's the whole program)
│   ├── sprout.svg       the buddy art, with named parts so it can be animated
│   ├── sprout-gutter.svg the tiny version that sits in your editor's gutter
│   └── leaf-icon.svg    the activity-bar button
├── quests/
│   ├── trading-bot.json the step-by-step for your trading-pattern bot
│   └── _format.md       how to write your own questline
└── test/
    └── logic.test.js    tests for the brain (run: npm test)
```

A rule worth stealing: **keep the platform-specific file (`extension.js`) thin, and put
real logic in plain files (`logic.js`) you can test instantly.** That one habit makes any
codebase easier to work on.

---

## How it works — five ideas

You only need five VS Code concepts to understand this whole project. Each links to where
it lives.

**1. Activation** — `package.json` → `activationEvents`, and `extension.js` → `activate()`.
VS Code reads `package.json` to learn what you contribute (a panel, commands, settings)
*before* running any of your code. Then, on the trigger (`onStartupFinished`), it calls
`activate()` once. That's your `main()`.

**2. A webview, and messaging** — `extension.js` → `StageProvider`, and `media/stage.js`.
A webview is a sandboxed web page. It can't call VS Code; it can only **post messages**.
So the two sides pass notes: `extension.js` sends `{type:'scene', …}` describing what's true;
`stage.js` sends back `{type:'nextStep'}` when a button is clicked. The security plumbing
(the `nonce`, the `Content-Security-Policy`, `asWebviewUri`) is in `StageProvider.html()` —
copy that pattern any time you make a webview.

**3. Diagnostics** — `extension.js` → `refresh()`. The red squiggles are "diagnostics."
`vscode.languages.getDiagnostics(uri)` gives you the current ones; `onDidChangeDiagnostics`
fires when they change. We filter to errors and reduce each to a "perch" in `logic.toPerches()`.

**4. Decorations** — `extension.js` → `paintGutter()`. `createTextEditorDecorationType` makes
a reusable style (here: the gutter bud); `editor.setDecorations(type, ranges)` stamps it onto
line ranges. Re-call it with new ranges and the markers "move." This is the real in-editor touch.

**5. Commands & memory** — `registerCommand` wires a function to the Command Palette;
`workspaceState` is a tiny per-project store (we remember your quest step in it).

That's it. Everything else is making Sprout cute, which is `stage.css` and `stage.js`.

---

## Your turn — lessons

Do these in order. Each is small, and each teaches one real thing. Make the change in the
first window, reload the Host window (⌘R / Ctrl-R), and see it.

**Lesson 1 — Name your buddy (warm-up).** Open VS Code settings in the Host window and set
`solarBuddy.name`. Notice it does nothing yet! Now make it do something: in `stage.js`,
show `msg.name` somewhere. *Teaches: settings flow from `package.json` → `getConfiguration` →
a message → the panel.*

**Lesson 2 — A new kind of coaching tip.** In `logic.js` → `coachError()`, add a rule for an
error you hit often. Add a test for it in `test/logic.test.js`, run `npm test`. *Teaches:
pure logic + tests, the fast loop that needs no VS Code.*

**Lesson 3 — Make Sprout swing in on a vine.** In `stage.js` → `renderErrors()`, the buddies
`run` to their perches. There's already a `swing` animation in `stage.css`. Play it on arrival
instead for buddies near the top of the strip. *Teaches: driving CSS animations from JS state.*

**Lesson 4 — React to warnings too, in a calmer way.** `toPerches()` takes an `errorsOnly`
option. Send warnings as a second, gentler group (maybe Sprout just points instead of
multiplying). *Teaches: the diagnostics severity model, and designing restraint.*

**Lesson 5 — A "focus" celebration.** When errors go from some to zero, play `celebrate()`
once (not every refresh). You'll need to remember the previous count. *Teaches: state across
renders — the thing `lastErrorSignature` already hints at.*

**Lesson 6 — Your own quest.** Copy `quests/trading-bot.json` to `quests/my-thing.json`,
rewrite the steps for a project you actually want to build, and switch to it with
**Solar Buddy: Choose a quest**. *Teaches: data-driven features — behaviour from a file, not code.*

**Stretch — real motion along the code.** Right now Sprout runs to a *fraction* across the
strip. Make her run to the actual **column** of the error (the `column` field is already on
each perch). *Teaches: mapping data coordinates to screen coordinates — the heart of any viz.*

---

## Make it yours

- **Palette:** every colour is a token at the top of `stage.css`. Change `--leaf` and the
  whole world shifts. There's a dark-mode block right below it.
- **Art:** `media/sprout.svg` is plain shapes with named groups. Give her a flower, a hat,
  antennae. The inline copy in `stage.html` uses *classes* (so clones stay valid) — keep the
  two in sync, or load one from the other once you're comfortable.
- **Liveliness:** the `solarBuddy.liveliness` setting (0.2–2) speeds up or calms every animation.
- **Run checks:** set `solarBuddy.checkCommand` (e.g. `python -m pytest -q`) and the "Run checks"
  button runs it in a terminal; the errors it produces come back as diagnostics Sprout reacts to.

---

## Is this a good first business?

Short version: **as a business, be skeptical; as a first *product* to ship and learn from,
it's excellent.** The honest reasons are in the chat where this was built, but the gist:
cute dev-tool companions have very low willingness-to-pay (the big one, `vscode-pets`, is
free and open-source), so the avatar itself rarely becomes a business. What *does* pay in
this neighbourhood is **teaching and onboarding** — gamified "learn to build X" paths, where
the buddy is the delivery, not the product. If you chase that, the quest engine here is the
seed of the real thing and the art is the hook. Ship this free, see if people love it, and
let what they ask for tell you where the business is.

---

## If F5 doesn't offer to run it

Create `.vscode/launch.json` in this folder with:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Solar Buddy",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"]
    }
  ]
}
```

---

MIT licensed. The trading-bot questline is deliberately honest about how often the real
answer is "mostly noise" — that's not pessimism, it's the actual skill. Have fun. 🌱
