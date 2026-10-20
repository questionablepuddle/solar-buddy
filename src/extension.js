'use strict';
/**
 * The VS Code side of Solar Buddy.
 *
 * This file is the "adapter": it listens to VS Code (which files you open, what errors
 * appear) and talks to the webview (the animated panel). It deliberately holds as little
 * thinking as possible — the thinking lives in logic.js. Read this top to bottom and you
 * will have met every VS Code API the project uses:
 *
 *   - activate(): the entry point VS Code calls once, on startup.
 *   - WebviewViewProvider: how a panel of our own HTML gets on screen.
 *   - languages.getDiagnostics / onDidChangeDiagnostics: the errors squiggled in your code.
 *   - window.onDidChangeActiveTextEditor: noticing when you switch files.
 *   - TextEditorDecorationType: putting our gutter marker on the real error lines.
 *   - commands.registerCommand: the things in the Command Palette.
 *   - tasks / Terminal: running your project's checks.
 */
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const logic = require('./logic');

let view = null;          // the live webview, once VS Code has built it
let decoration = null;    // our gutter-marker style
let quest = null;         // the loaded questline
let stepIndex = 0;        // how far through the quest we are (remembered between sessions)
let context = null;

function activate(ctx) {
  context = ctx;

  // A style for the little Sprout bud that sits in the gutter next to an error line.
  decoration = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.joinPath(ctx.extensionUri, 'media', 'sprout-gutter.svg'),
    gutterIconSize: 'contain',
  });

  // Remember quest progress across restarts. workspaceState is a tiny per-project key/value store.
  stepIndex = ctx.workspaceState.get('solarBuddy.stepIndex', 0);
  quest = loadQuest(ctx);

  // Register our panel. VS Code calls the provider when the view first becomes visible.
  const provider = new StageProvider(ctx);
  ctx.subscriptions.push(vscode.window.registerWebviewViewProvider('solarBuddy.stage', provider));

  // React to the world. Every subscription is pushed onto ctx.subscriptions so VS Code
  // cleans them up when the extension unloads — forgetting this is a classic leak.
  ctx.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => refresh()),
    vscode.window.onDidChangeActiveTextEditor(() => refresh()),
    vscode.commands.registerCommand('solarBuddy.nextStep', nextStep),
    vscode.commands.registerCommand('solarBuddy.rescan', refresh),
    vscode.commands.registerCommand('solarBuddy.runChecks', runChecks),
    vscode.commands.registerCommand('solarBuddy.pickQuest', pickQuest)
  );
}

function deactivate() {
  if (decoration) decoration.dispose();
}

// ------------------------------------------------------------------ loading a questline
function questsDir() {
  return path.join(context.extensionUri.fsPath, 'quests');
}
function loadQuest(ctx) {
  const name = vscode.workspace.getConfiguration('solarBuddy').get('quest', 'trading-bot');
  try {
    const data = JSON.parse(fs.readFileSync(path.join(questsDir(), `${name}.json`), 'utf8'));
    const problem = logic.validateQuest(data);
    if (problem) {
      vscode.window.showWarningMessage(`Solar Buddy: ${name}.json — ${problem}`);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

// ------------------------------------------------------------------ the heart: look, then show
/** Gather the current state of the world, ask logic.js what to do, and show it. */
function refresh() {
  if (!view) return;
  const editor = vscode.window.activeTextEditor;
  let perches = [];
  let fileName = '';
  let lines = {};
  if (editor) {
    fileName = path.basename(editor.document.fileName);
    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    perches = logic.toPerches(diagnostics);
    // send the actual text of each error line, so Sprout can run across your real code
    for (const p of perches) {
      if (p.line < editor.document.lineCount) lines[p.line] = editor.document.lineAt(p.line).text;
    }
    paintGutter(editor, perches);
  }
  const scene = logic.planScene({ perches, fileName, quest, stepIndex, lines });
  view.webview.postMessage({ type: 'scene', scene, liveliness: liveliness(), name: buddyName() });
}

/** Put the gutter marker on each real error line in the editor (the honest in-code integration). */
function paintGutter(editor, perches) {
  const ranges = perches.map((p) => new vscode.Range(p.line, 0, p.line, 0));
  editor.setDecorations(decoration, ranges);
}

function buddyName() {
  return vscode.workspace.getConfiguration('solarBuddy').get('name', 'Sprout');
}
function liveliness() {
  return vscode.workspace.getConfiguration('solarBuddy').get('liveliness', 1);
}

// ------------------------------------------------------------------ commands
function nextStep() {
  if (!quest) {
    vscode.window.showInformationMessage('Solar Buddy: no quest loaded. Try "Choose a quest".');
    return;
  }
  stepIndex = logic.advance(stepIndex, quest);
  context.workspaceState.update('solarBuddy.stepIndex', stepIndex);
  refresh();
}

async function pickQuest() {
  let files = [];
  try {
    files = fs.readdirSync(questsDir()).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  } catch (_) {
    /* no quests folder */
  }
  if (!files.length) return vscode.window.showInformationMessage('Solar Buddy: no quest files in quests/.');
  const pick = await vscode.window.showQuickPick(files, { title: 'Choose a quest' });
  if (!pick) return;
  await vscode.workspace.getConfiguration('solarBuddy').update('quest', pick, vscode.ConfigurationTarget.Workspace);
  stepIndex = 0;
  context.workspaceState.update('solarBuddy.stepIndex', 0);
  quest = loadQuest(context);
  refresh();
}

/** Run the project's own checks in a real terminal. Sprout can't draw inside the terminal,
 *  but the errors a test run produces come back as diagnostics, so it reacts to the result. */
function runChecks() {
  const cmd = vscode.workspace.getConfiguration('solarBuddy').get('checkCommand', '');
  if (!cmd) {
    vscode.window.showInformationMessage('Solar Buddy: set "solarBuddy.checkCommand" first (e.g. python -m pytest).');
    return;
  }
  const term = vscode.window.terminals.find((t) => t.name === 'Sprout') || vscode.window.createTerminal('Sprout');
  term.show(true);
  term.sendText(cmd);
}

// ------------------------------------------------------------------ the webview provider
class StageProvider {
  constructor(ctx) {
    this.ctx = ctx;
  }
  resolveWebviewView(webviewView) {
    view = webviewView;
    webviewView.webview.options = {
      enableScripts: true, // our stage needs JavaScript to animate
      localResourceRoots: [vscode.Uri.joinPath(this.ctx.extensionUri, 'media')],
    };
    webviewView.webview.html = this.html(webviewView.webview);

    // messages coming back from the stage (e.g. the "What's next" button inside the panel)
    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'nextStep') nextStep();
      else if (msg.type === 'runChecks') runChecks();
      else if (msg.type === 'ready') refresh();
    });
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) refresh();
    });
  }

  /** Build the panel's HTML. The fiddly bits (nonce, CSP, asWebviewUri) are security plumbing,
   *  explained in the README — copy this pattern for any webview you make. */
  html(webview) {
    const media = (name) => webview.asWebviewUri(vscode.Uri.joinPath(this.ctx.extensionUri, 'media', name));
    const nonce = String(Math.random()).slice(2) + String(Date.now());
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');
    const html = fs.readFileSync(path.join(this.ctx.extensionUri.fsPath, 'media', 'stage.html'), 'utf8');
    return html
      .replace(/\$\{csp\}/g, csp)
      .replace(/\$\{nonce\}/g, nonce)
      .replace(/\$\{style\}/g, media('stage.css'))
      .replace(/\$\{script\}/g, media('stage.js'))
      .replace(/\$\{sprout\}/g, media('sprout.svg'));
  }
}

module.exports = { activate, deactivate };
