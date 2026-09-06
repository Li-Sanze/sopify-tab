(() => {
  const root = document.documentElement;
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const night = mq.matches;
    root.dataset.sky = night ? 'night' : 'day';
    root.style.colorScheme = night ? 'dark' : 'light';
  };
  apply();
  mq.addEventListener('change', apply);
})();
