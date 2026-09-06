(() => {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    document.documentElement.dataset.sky = mq.matches ? 'night' : 'day';
  };
  apply();
  mq.addEventListener('change', apply);
})();
