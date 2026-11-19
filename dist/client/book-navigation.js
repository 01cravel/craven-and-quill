(() => {
  const menu = document.querySelector('.book-menu');
  if (!menu) return;
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  for (const type of ['click', 'focusin']) document.addEventListener(type, event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) menu.open = false;
  });
})();
