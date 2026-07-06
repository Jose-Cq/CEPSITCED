/**
 * Protege los iconos de Material Symbols contra la traducción automática del navegador.
 * Usa MutationObserver para proteger iconos nuevos que se agreguen al DOM.
 */
export function disableIconTranslation() {
  // Proteger iconos existentes
  protectIcons();

  // Observar nuevos nodos que se agreguen al DOM
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          if (isIcon(node)) {
            protectElement(node);
          }
          // Buscar iconos hijos
          if (node.querySelectorAll) {
            node.querySelectorAll('[class*="material-symbols"]').forEach(protectElement);
          }
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function isIcon(el) {
  return el.classList && (
    el.classList.contains('material-symbols-outlined') ||
    el.classList.contains('material-symbols-rounded') ||
    el.classList.contains('material-symbols-sharp')
  );
}

function protectElement(el) {
  if (el.getAttribute('translate') !== 'no') {
    el.setAttribute('translate', 'no');
  }
  if (!el.classList.contains('notranslate')) {
    el.classList.add('notranslate');
  }
}

function protectIcons() {
  document.querySelectorAll('[class*="material-symbols"]').forEach(protectElement);
}
