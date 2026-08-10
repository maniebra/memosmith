/**
 * Moves a node to `<body>` for as long as it lives.
 *
 * A `position: fixed` popup is normally placed against the viewport — unless an
 * ancestor has `filter`, `backdrop-filter`, `transform` or `contain`, any of
 * which makes that ancestor the containing block instead, so the popup lands at
 * an offset from where it was measured. Portalling sidesteps that entirely, and
 * also frees the popup from ancestor `overflow` clipping and stacking contexts.
 */
export function portal(node: HTMLElement) {
  // Marks the node as popup chrome, so outside-click tests can spare it.
  node.dataset.portal = "";
  document.body.appendChild(node);
  return {
    destroy() {
      node.remove();
    },
  };
}
