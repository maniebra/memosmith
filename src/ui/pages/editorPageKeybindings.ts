import type { Keybinding } from "../../lib/utils/keybindings";
import type { EditorPageActions, EditorPageContext } from "./editorPageContext";
import type { createTabActions } from "./editorPageTabActions";

function cycleTab(tabs: ReturnType<typeof createTabActions>, step: 1 | -1) {
  return (event: KeyboardEvent) => {
    event.preventDefault();
    tabs.cycleTabs(step);
  };
}

function chromeKeybindings(
  context: EditorPageContext,
  actions: EditorPageActions,
  tabs: ReturnType<typeof createTabActions>,
): Keybinding[] {
  return [
    {
      combination: "mod+b",
      type: "combinational",
      name: "app.toggleSpacePane",
      description: "Show or hide the space pane.",
      action: (event) => {
        event.preventDefault();
        actions.toggleSpacePane();
      },
    },
    {
      combination: "mod+tab",
      type: "combinational",
      name: "app.nextTab",
      description: "Cycle to the next tab.",
      action: cycleTab(tabs, 1),
    },
    {
      combination: "mod+shift+tab",
      type: "combinational",
      name: "app.previousTab",
      description: "Cycle to the previous tab.",
      action: cycleTab(tabs, -1),
    },
    {
      combination: "mod+w",
      type: "combinational",
      name: "app.closeTab",
      description: "Close the active tab.",
      action: (event) => {
        if (!context.activeTab) {
          return false;
        }
        event.preventDefault();
        void tabs.closeTab(context.activeTab);
      },
    },
  ];
}

function toggleSettings(context: EditorPageContext) {
  return (event: KeyboardEvent) => {
    event.preventDefault();
    context.settingsOpen = !context.settingsOpen;
  };
}

function overlayKeybindings(context: EditorPageContext): Keybinding[] {
  return [
    {
      combination: "escape",
      type: "combinational",
      name: "app.closeOverlays",
      description: "Close the settings or databases overlay.",
      action: () => {
        if (!context.settingsOpen && !context.databasesOpen) {
          return false;
        }
        context.settingsOpen = false;
        context.databasesOpen = false;
      },
    },
    {
      combination: "mod+,",
      type: "combinational",
      name: "app.settings",
      description: "Toggle the settings overlay.",
      action: toggleSettings(context),
    },
    {
      combination: "mod+k mod+s",
      type: "sequential",
      name: "app.settingsChord",
      description: "Toggle the settings overlay.",
      action: toggleSettings(context),
    },
    {
      combination: "mod+k mod+d",
      type: "sequential",
      name: "app.databases",
      description: "Toggle the databases overlay.",
      action: (event) => {
        if (!context.settings.features.databases) {
          return false;
        }
        event.preventDefault();
        context.databasesOpen = !context.databasesOpen;
      },
    },
  ];
}

/** Window-level shortcuts for the editor page: tabs, overlays and panes. */
export function createEditorPageKeybindings(
  context: EditorPageContext,
  actions: EditorPageActions,
  tabs: ReturnType<typeof createTabActions>,
): Keybinding[] {
  return [
    ...chromeKeybindings(context, actions, tabs),
    ...overlayKeybindings(context),
  ];
}
