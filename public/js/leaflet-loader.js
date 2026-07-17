window.__leafletReady = new Promise((resolve, reject) => {
  const sources = [
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
  ];
  let index = 0;
  const loadNext = () => {
    if (window.L) { resolve(); return; }
    if (index >= sources.length) { reject(new Error('Leaflet load failed')); return; }
    const script = document.createElement('script');
    script.src = sources[index++];
    script.async = false;
    script.onload = () => window.L ? resolve() : loadNext();
    script.onerror = loadNext;
    document.head.appendChild(script);
  };
  loadNext();
});
