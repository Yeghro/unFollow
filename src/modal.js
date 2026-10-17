import "./modal.css";

// Lightweight styled dialog that replaces window.alert() for status notices.
// Content is set via textContent only, so messages can never inject markup.
const ICONS = { success: "✓", error: "!", info: "i", warning: "?" };

let closeActive = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// stats: [{ label, value }]. Resolves true when the primary button is used and
// false when dismissed (Esc, backdrop click or the cancel button). Passing
// cancelText adds a cancel button and focuses it first (safe default).
export function showModal({
  type = "info",
  title,
  message = "",
  stats = [],
  buttonText = "Done",
  cancelText = "",
}) {
  if (closeActive) closeActive();

  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement;

    const overlay = element("div", "modal-overlay");
    const dialog = element("div", `modal-dialog modal-${type}`);
    dialog.setAttribute("role", type === "error" ? "alertdialog" : "dialog");
    dialog.setAttribute("aria-modal", "true");

    const titleId = `modal-title-${Date.now()}`;
    const heading = element("h2", "modal-title", title);
    heading.id = titleId;
    dialog.setAttribute("aria-labelledby", titleId);

    dialog.append(element("div", "modal-icon", ICONS[type] || ICONS.info), heading);

    if (message) dialog.append(element("p", "modal-message", message));

    if (stats.length > 0) {
      const grid = element("div", "modal-stats");
      for (const { label, value } of stats) {
        const tile = element("div", "modal-stat");
        tile.append(
          element("span", "modal-stat-value", String(value)),
          element("span", "modal-stat-label", label)
        );
        grid.append(tile);
      }
      dialog.append(grid);
    }

    const button = element("button", "modal-button", buttonText);
    button.type = "button";
    const buttons = [button];
    const actions = element("div", "modal-actions");
    if (cancelText) {
      const cancel = element("button", "modal-button modal-button-secondary", cancelText);
      cancel.type = "button";
      cancel.addEventListener("click", () => close(false));
      buttons.unshift(cancel);
    }
    actions.append(...buttons);
    dialog.append(actions);
    overlay.append(dialog);

    const close = (confirmed = true) => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      document.body.classList.remove("modal-open");
      closeActive = null;
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
      resolve(confirmed);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") close(false);
      // Keep focus inside the dialog, cycling through its buttons
      if (event.key === "Tab") {
        event.preventDefault();
        const index = buttons.indexOf(document.activeElement);
        const step = event.shiftKey ? -1 : 1;
        buttons[(index + step + buttons.length) % buttons.length].focus();
      }
    };

    button.addEventListener("click", () => close(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(false);
    });
    document.addEventListener("keydown", onKeyDown);

    closeActive = () => close(false);
    document.body.classList.add("modal-open");
    document.body.append(overlay);
    buttons[0].focus();
  });
}

// Styled replacement for window.confirm(); resolves true only on the primary button.
export function showConfirm({
  title,
  message,
  stats,
  confirmText = "Confirm",
  cancelText = "Cancel",
}) {
  return showModal({
    type: "warning",
    title,
    message,
    stats,
    buttonText: confirmText,
    cancelText,
  });
}
