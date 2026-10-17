import "./modal.css";

// Lightweight styled dialog that replaces window.alert() for status notices.
// Content is set via textContent only, so messages can never inject markup.
const ICONS = { success: "✓", error: "!", info: "i" };

let closeActive = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// stats: [{ label, value }]. Resolves when the dialog is dismissed.
export function showModal({
  type = "info",
  title,
  message = "",
  stats = [],
  buttonText = "Done",
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
    dialog.append(button);
    overlay.append(dialog);

    const close = () => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      document.body.classList.remove("modal-open");
      closeActive = null;
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
      resolve();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
      // The button is the only focusable element: keep focus inside the dialog
      if (event.key === "Tab") {
        event.preventDefault();
        button.focus();
      }
    };

    button.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    document.addEventListener("keydown", onKeyDown);

    closeActive = close;
    document.body.classList.add("modal-open");
    document.body.append(overlay);
    button.focus();
  });
}
