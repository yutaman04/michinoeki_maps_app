(async function bootApp() {
  const loadingEl = document.getElementById('countInfo');
  const statusEl = document.getElementById('status');
  try {
    await window.__leafletReady;
  } catch (error) {
    console.error(error);
    statusEl.textContent = '地図ライブラリを読み込めませんでした。通信環境を確認してください。';
    loadingEl.textContent = '地図を読み込めませんでした';
    const list = document.getElementById('stationList');
    list.innerHTML = '<div style="padding:16px;line-height:1.7">地図ライブラリの読み込みに失敗しました。Safariでインターネット接続を有効にして再読み込みしてください。<br>ChatGPTアプリ内プレビューでは外部ライブラリが制限される場合があります。</div>';
    return;
  }
  try {

const MOBILE_VIEW_STORAGE_KEY = 'michinoeki_mobile_view_v1';

function isMobileLayout() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function setMobileView(mode, save = true) {
  const allowed = new Set(['list', 'split', 'map']);
  const nextMode = allowed.has(mode) ? mode : 'split';
  const layout = document.getElementById('layout');
  layout.dataset.mobileView = nextMode;
  document.querySelectorAll('.mobile-view-button').forEach(button => {
    const active = button.dataset.view === nextMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  if (save) {
    try { localStorage.setItem(MOBILE_VIEW_STORAGE_KEY, nextMode); } catch (e) {}
  }
  // display:noneから地図を復帰した際、Leafletに新しい表示寸法を再計算させる。
  if (nextMode !== 'list') {
    requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
  }
}

function initializeMobileView() {
  let saved = 'split';
  try { saved = localStorage.getItem(MOBILE_VIEW_STORAGE_KEY) || 'split'; } catch (e) {}
  setMobileView(saved, false);
  document.querySelectorAll('.mobile-view-button').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      setMobileView(button.dataset.view);
    });
  });
  window.addEventListener('resize', () => {
    if (!isMobileLayout()) return;
    const mode = document.getElementById('layout').dataset.mobileView;
    if (mode !== 'list') requestAnimationFrame(() => map.invalidateSize({ pan: false }));
  });
}

const map = L.map('map');
map.setView([43.7, 144.6], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const routePreviewLayer = L.layerGroup().addTo(map);
const currentLocationLayer = L.layerGroup().addTo(map);
const STORAGE_KEYS = {
  completed: 'okhotsk_doto_stamp_completed_v1',
  route: 'okhotsk_doto_route_selection_v1'
};

function loadStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function saveStoredArray(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('LocalStorageへの保存に失敗しました', e);
  }
}
const state = {
  markers: new Map(),
  activeAreas: new Set(["オホーツク", "十勝", "釧路・根室"]),
  searchText: '',
  completed: new Set(loadStoredArray(STORAGE_KEYS.completed)),
  route: loadStoredArray(STORAGE_KEYS.route).filter(name => stations.some(s => s.name === name)),
  currentLocation: null,
  listTab: 'all'
};

function cacheKey(station) {
  return `michinoeki_geo_v1_${station.name}_${station.address}`;
}

function setCompleted(name, checked) {
  if (checked) state.completed.add(name);
  else state.completed.delete(name);
  saveStoredArray(STORAGE_KEYS.completed, Array.from(state.completed));
  syncAllViews();
}

function setRouteSelected(name, checked) {
  if (checked && !state.route.includes(name)) state.route.push(name);
  if (!checked) state.route = state.route.filter(item => item !== name);
  saveStoredArray(STORAGE_KEYS.route, state.route);
  syncAllViews();
}

function syncAllViews() {
  renderList();
  renderRoutePanel();
  updateRoutePreview();
  refreshAllPopups();
}

function buildPopupContent(station, gmap) {
  const wrapper = document.createElement('div');
  const routeIndex = state.route.indexOf(station.name);
  const completed = state.completed.has(station.name);
  wrapper.innerHTML = `
    <div class="popup-shell">
      ${completed ? '<div class="stamp-seal popup-stamp-seal" aria-label="押印済み">済</div>' : ''}
      <div class="popup-title">${station.name}</div>
      <div><span class="badge">${station.area}</span><span class="badge">${station.municipality}</span></div>
      <div><strong>電話：</strong> ${station.phone}</div>
      <div><strong>住所：</strong> ${station.address}</div>
      <div><strong>スタンプ押印：</strong> ${station.stamp_hours}</div>
      <div class="popup-controls">
        <label><input type="checkbox" data-popup-completed ${completed ? 'checked' : ''}> 押印済み</label>
        <label><input type="checkbox" data-popup-route ${routeIndex >= 0 ? 'checked' : ''}> ルートに追加${routeIndex >= 0 ? `（${routeIndex + 1}番目）` : ''}</label>
      </div>
      <div><a href="${gmap}" target="_blank" rel="noopener noreferrer">Google Mapsで開く</a></div>
    </div>`;
  wrapper.querySelector('[data-popup-completed]').addEventListener('change', event => {
    setCompleted(station.name, event.target.checked);
  });
  wrapper.querySelector('[data-popup-route]').addEventListener('change', event => {
    setRouteSelected(station.name, event.target.checked);
  });
  return wrapper;
}

function buildStationIcon(station) {
  const completed = state.completed.has(station.name);
  return L.divIcon({
    className: '',
    html: `<div class="station-marker-wrap" style="--station-color:${colorByArea[station.area]}">
      <div class="station-marker-dot"></div>
      ${completed ? '<div class="station-marker-stamped" aria-label="押印済み">✓</div>' : ''}
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -10]
  });
}

function createMarker(station, lat, lon) {
  const marker = L.marker([lat, lon], { icon: buildStationIcon(station) });
  const gmap = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.address + ' ' + station.name)}`;
  marker.bindPopup(() => buildPopupContent(station, gmap));
  return marker;
}

function stationMatches(station) {
  const areaOk = state.activeAreas.has(station.area);
  const q = state.searchText.trim().toLowerCase();
  if (!areaOk) return false;
  if (!q) return true;
  return [station.name, station.municipality, station.address, station.phone, station.area].join(' ').toLowerCase().includes(q);
}

function renderList(fitMap = false) {
  const list = document.getElementById('stationList');
  list.innerHTML = '';
  const filtered = stations.filter(s => stationMatches(s) && (state.listTab !== 'stamped' || state.completed.has(s.name)));
  document.getElementById('countInfo').textContent = `${filtered.length} / ${stations.length} 件表示`;
  document.getElementById('progressCounter').textContent = `押印済み ${state.completed.size} / ${stations.length} 駅`;
  document.getElementById('openRoutePanel').textContent = `ルート設計（${state.route.length}駅）`;

  filtered.forEach(station => {
    const el = document.createElement('div');
    el.className = 'station-item';
    if (state.completed.has(station.name)) el.classList.add('completed');
    if (state.route.includes(station.name)) el.classList.add('in-route');
    const gmap = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.address + ' ' + station.name)}`;
    el.innerHTML = `
      ${state.completed.has(station.name) ? '<div class="stamp-seal station-stamp-seal" aria-label="押印済み">済</div>' : ''}
      <div class="station-name">${station.name}</div>
      <div class="station-meta"><span class="badge">${station.area}</span><span class="badge">${station.municipality}</span></div>
      <div class="station-meta"><strong>電話番号：</strong> ${station.phone}</div>
      <div class="station-meta"><strong>住所：</strong> ${station.address}</div>
      <div class="station-meta"><strong>スタンプ押印：</strong> ${station.stamp_hours}</div>
      <div class="control-row">
        <label class="check-label"><input type="checkbox" data-action="completed" ${state.completed.has(station.name) ? 'checked' : ''}> 押印済み</label>
        <label class="check-label"><input type="checkbox" data-action="route" ${state.route.includes(station.name) ? 'checked' : ''}> ルートに追加</label>
      </div>
      <div class="actions">
        <button data-action="zoom">地図で見る</button>
        <button data-action="copy">電話番号コピー</button>
        <a class="btn-link" href="${gmap}" target="_blank" rel="noopener noreferrer">Google Maps</a>
      </div>
    `;
    const focusStation = () => {
      const marker = state.markers.get(station.name);
      if (marker) {
        map.setView(marker.getLatLng(), 12, { animate: true });
        marker.openPopup();
      }
    };
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${station.name}を地図で表示`);
    el.addEventListener('click', (event) => {
      if (event.target.closest('button, a, input, label')) return;
      focusStation();
    });
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        focusStation();
      }
    });
    el.querySelector('[data-action="completed"]').addEventListener('change', (event) => {
      event.stopPropagation();
      setCompleted(station.name, event.target.checked);
    });
    el.querySelector('[data-action="route"]').addEventListener('change', (event) => {
      event.stopPropagation();
      setRouteSelected(station.name, event.target.checked);
    });
    el.querySelector('[data-action="zoom"]').addEventListener('click', (event) => {
      event.stopPropagation();
      const marker = state.markers.get(station.name);
      if (marker) {
        map.setView(marker.getLatLng(), 10);
        marker.openPopup();
      } else {
        alert('まだ位置情報の読み込み中です。数秒後に再度お試しください。');
      }
    });
    el.querySelector('[data-action="copy"]').addEventListener('click', async (event) => {
      event.stopPropagation();
      try {
        await navigator.clipboard.writeText(station.phone);
        alert(`電話番号をコピーしました: ${station.phone}`);
      } catch (e) {
        alert(`コピーできなかったため、手動でご利用ください: ${station.phone}`);
      }
    });
    list.appendChild(el);
  });

  updateMarkerVisibility(fitMap);
}

function updateMarkerVisibility(fitMap = false) {
  markerLayer.clearLayers();
  const visible = [];
  stations.forEach(station => {
    const marker = state.markers.get(station.name);
    if (marker && stationMatches(station)) {
      markerLayer.addLayer(marker);
      visible.push(marker);
    }
  });
  if (fitMap && visible.length > 0) {
    const group = L.featureGroup(visible);
    map.fitBounds(group.getBounds().pad(0.15));
  }
}


function refreshAllPopups() {
  stations.forEach(station => {
    const marker = state.markers.get(station.name);
    if (!marker) return;
    const wasOpen = marker.isPopupOpen();
    marker.setIcon(buildStationIcon(station));
    const gmap = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.address + ' ' + station.name)}`;
    marker.setPopupContent(buildPopupContent(station, gmap));
    if (wasOpen) marker.openPopup();
  });
}

function updateRoutePreview() {
  routePreviewLayer.clearLayers();
  currentLocationLayer.clearLayers();
  const selected = state.route.map(name => stations.find(s => s.name === name)).filter(Boolean);

  if (state.currentLocation) {
    L.circleMarker([state.currentLocation.lat, state.currentLocation.lon], {
      radius: 8, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1
    }).bindTooltip('現在地').addTo(currentLocationLayer);
  }

  if (!selected.length) return;
  const coords = selected.map(s => [s.lat, s.lon]);
  const previewCoords = state.currentLocation
    ? [[state.currentLocation.lat, state.currentLocation.lon], ...coords]
    : coords;
  if (previewCoords.length >= 2) {
    L.polyline(previewCoords, { color: '#f0a202', weight: 4, opacity: 0.8, dashArray: '8 6' }).addTo(routePreviewLayer);
  }
  selected.forEach((station, index) => {
    L.marker([station.lat, station.lon], {
      icon: L.divIcon({
        className: 'route-marker-number',
        html: String(index + 1),
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      }),
      interactive: false
    }).addTo(routePreviewLayer);
  });
}

function moveRouteItem(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= state.route.length) return;
  [state.route[index], state.route[target]] = [state.route[target], state.route[index]];
  saveStoredArray(STORAGE_KEYS.route, state.route);
  renderRoutePanel();
  renderList();
  updateRoutePreview();
  refreshAllPopups();
}

function haversineKm(a, b) {
  const rad = deg => deg * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const lat1 = rad(a.lat), lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function routeDistance(order) {
  let total = 0;
  for (let i = 1; i < order.length; i++) total += haversineKm(order[i - 1], order[i]);
  return total;
}

function nearestNeighborFrom(points, startIndex) {
  const remaining = points.map((_, i) => i).filter(i => i !== startIndex);
  const order = [points[startIndex]];
  let current = startIndex;
  while (remaining.length) {
    let bestPos = 0;
    let bestDist = Infinity;
    remaining.forEach((idx, pos) => {
      const d = haversineKm(points[current], points[idx]);
      if (d < bestDist) { bestDist = d; bestPos = pos; }
    });
    current = remaining.splice(bestPos, 1)[0];
    order.push(points[current]);
  }
  return order;
}

function twoOptOpenPath(order) {
  let improved = true;
  let best = order.slice();
  let bestDistance = routeDistance(best);
  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        const distance = routeDistance(candidate);
        if (distance + 0.01 < bestDistance) {
          best = candidate;
          bestDistance = distance;
          improved = true;
        }
      }
    }
  }
  return best;
}

function getCurrentPositionAsync() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('このブラウザは位置情報取得に対応していません。'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      error => {
        const messages = {
          1: '位置情報の利用が許可されていません。ブラウザのサイト設定で位置情報を許可してください。',
          2: '現在地を取得できませんでした。GPSや通信状態を確認してください。',
          3: '現在地の取得がタイムアウトしました。もう一度お試しください。'
        };
        reject(new Error(messages[error.code] || '現在地の取得に失敗しました。'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

async function optimizeRouteFromCurrentLocation() {
  const points = state.route.map(name => stations.find(s => s.name === name)).filter(Boolean);
  if (points.length < 2) {
    alert('現在地からの最適化には2駅以上を選択してください。');
    return;
  }

  const button = document.getElementById('optimizeFromCurrent');
  const locationStatus = document.getElementById('locationStatus');
  button.disabled = true;
  button.textContent = '現在地を取得中…';
  locationStatus.textContent = '現在地：取得中…';

  try {
    const current = await getCurrentPositionAsync();
    state.currentLocation = current;

    const remaining = points.slice();
    const initialOrder = [{ name: '__CURRENT__', lat: current.lat, lon: current.lon }];
    let cursor = initialOrder[0];
    while (remaining.length) {
      let bestIndex = 0;
      let bestDistance = Infinity;
      remaining.forEach((point, index) => {
        const distance = haversineKm(cursor, point);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      cursor = remaining.splice(bestIndex, 1)[0];
      initialOrder.push(cursor);
    }

    const optimizedWithCurrent = twoOptOpenPath(initialOrder);
    const optimizedStations = optimizedWithCurrent.filter(point => point.name !== '__CURRENT__');
    state.route = optimizedStations.map(station => station.name);
    saveStoredArray(STORAGE_KEYS.route, state.route);

    const totalDistance = routeDistance(optimizedWithCurrent);
    const accuracyText = Number.isFinite(current.accuracy) ? `（精度 約${Math.round(current.accuracy)}m）` : '';
    locationStatus.textContent = `現在地：取得済み${accuracyText}`;
    syncAllViews();
    map.setView([current.lat, current.lon], Math.max(map.getZoom(), 9), { animate: true });
    alert(`現在地を出発点として近似最短順へ並べ替えました（直線距離の合計 約${Math.round(totalDistance)}km）。実際の道路ルートはGoogle Mapsでご確認ください。`);
  } catch (error) {
    state.currentLocation = null;
    locationStatus.textContent = `現在地：取得失敗 — ${error.message}`;
    updateRoutePreview();
    alert(error.message + '\n\nGitHub PagesのHTTPS URLをSafariまたはChromeで開き、位置情報を許可してください。');
  } finally {
    button.disabled = false;
    button.textContent = '現在地から最適化';
  }
}

function optimizeRouteOrder() {
  const points = state.route.map(name => stations.find(s => s.name === name)).filter(Boolean);
  if (points.length < 3) {
    alert('順番の最適化には3駅以上を選択してください。');
    return;
  }
  let bestOrder = null;
  let bestDistance = Infinity;
  points.forEach((_, startIndex) => {
    const candidate = twoOptOpenPath(nearestNeighborFrom(points, startIndex));
    const distance = routeDistance(candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestOrder = candidate;
    }
  });
  state.route = bestOrder.map(station => station.name);
  saveStoredArray(STORAGE_KEYS.route, state.route);
  syncAllViews();
  alert(`地点間の直線距離を基準に、近似最短順へ並べ替えました（約${Math.round(bestDistance)}km）。実際の道路距離・所要時間はGoogle Mapsでご確認ください。`);
}

function buildGoogleMapsUrls() {
  const selected = state.route.map(name => stations.find(s => s.name === name)).filter(Boolean);
  if (selected.length < 2) return [];
  const maxPointsPerSegment = 10;
  const segments = [];
  let start = 0;
  while (start < selected.length - 1) {
    const segment = selected.slice(start, Math.min(start + maxPointsPerSegment, selected.length));
    segments.push(segment);
    start += maxPointsPerSegment - 1;
  }
  return segments.map(segment => {
    const place = s => `${s.lat},${s.lon}`;
    const isFirstSegment = segment === segments[0];
    const origin = isFirstSegment && state.currentLocation
      ? `${state.currentLocation.lat},${state.currentLocation.lon}`
      : place(segment[0]);
    const destination = place(segment[segment.length - 1]);
    const waypoints = (isFirstSegment && state.currentLocation ? segment.slice(0, -1) : segment.slice(1, -1)).map(place).join('|');
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
    return url;
  });
}

function renderRoutePanel() {
  const list = document.getElementById('routeList');
  list.innerHTML = '';
  if (!state.route.length) {
    list.innerHTML = '<div class="route-help">まだ道の駅が選択されていません。</div>';
  }
  state.route.forEach((name, index) => {
    const station = stations.find(s => s.name === name);
    if (!station) return;
    const row = document.createElement('div');
    row.className = 'route-item';
    row.innerHTML = `
      <div class="route-number">${index + 1}</div>
      <div><div class="route-name">${station.name}</div><div class="station-meta">${station.municipality}</div></div>
      <div class="route-controls">
        <button data-move="up" title="上へ">↑</button>
        <button data-move="down" title="下へ">↓</button>
        <button data-remove title="削除">×</button>
      </div>`;
    row.querySelector('[data-move="up"]').addEventListener('click', () => moveRouteItem(index, -1));
    row.querySelector('[data-move="down"]').addEventListener('click', () => moveRouteItem(index, 1));
    row.querySelector('[data-remove]').addEventListener('click', () => {
      state.route = state.route.filter(n => n !== name);
      saveStoredArray(STORAGE_KEYS.route, state.route);
      renderRoutePanel(); renderList(); updateRoutePreview(); refreshAllPopups();
    });
    list.appendChild(row);
  });
  document.getElementById('openRoutePanel').textContent = `ルート設計（${state.route.length}駅）`;
  const links = document.getElementById('routeLinks');
  const urls = buildGoogleMapsUrls();
  links.innerHTML = urls.length > 1
    ? `<strong>選択地点が多いため、${urls.length}区間に分割します：</strong><br>` + urls.map((url, i) => `<a href="${url}" target="_blank" rel="noopener noreferrer">区間${i + 1}をGoogle Mapsで開く</a>`).join('<br>')
    : '';
}

function initializeFixedMarkers() {
  stations.forEach(station => {
    const marker = createMarker(station, station.lat, station.lon);
    state.markers.set(station.name, marker);
  });
  document.getElementById('status').textContent = `全 ${stations.length} 駅を表示可能`;
  renderList(true);
  renderRoutePanel();
  updateRoutePreview();
}

Array.from(document.querySelectorAll('.list-tab')).forEach(tab => {
  tab.addEventListener('click', () => {
    state.listTab = tab.dataset.tab;
    document.querySelectorAll('.list-tab').forEach(t => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    renderList();
  });
});

Array.from(document.querySelectorAll('.area-filter')).forEach(cb => {
  cb.addEventListener('change', () => {
    state.activeAreas = new Set(Array.from(document.querySelectorAll('.area-filter:checked')).map(el => el.value));
    renderList(true);
  });
});

document.getElementById('search').addEventListener('input', (e) => {
  state.searchText = e.target.value;
  renderList(true);
});

document.getElementById('openRoutePanel').addEventListener('click', () => {
  document.getElementById('routePanel').classList.add('open');
  renderRoutePanel();
});
document.getElementById('closeRoutePanel').addEventListener('click', () => document.getElementById('routePanel').classList.remove('open'));
document.getElementById('optimizeFromCurrent').addEventListener('click', optimizeRouteFromCurrentLocation);
document.getElementById('optimizeRoute').addEventListener('click', optimizeRouteOrder);
document.getElementById('reverseRoute').addEventListener('click', () => {
  state.route.reverse();
  saveStoredArray(STORAGE_KEYS.route, state.route);
  renderRoutePanel(); renderList(); updateRoutePreview(); refreshAllPopups();
});
function clearRouteSelection() {
  // 配列を同じ参照のまま空にし、参照を保持している処理とも確実に同期する。
  state.route.splice(0, state.route.length);
  state.currentLocation = null;
  const locationStatus = document.getElementById('locationStatus');
  if (locationStatus) locationStatus.textContent = '現在地：未取得';

  // 空配列の保存に加えて、古い値が復元されないようキー自体も削除する。
  try {
    localStorage.removeItem(STORAGE_KEYS.route);
  } catch (e) {
    console.warn('LocalStorageのルート情報削除に失敗しました', e);
  }

  // 開いているポップアップを閉じてから、全入力箇所を単一状態から再描画する。
  map.closePopup();
  syncAllViews();
}

document.getElementById('clearRoute').addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (state.route.length === 0) {
    clearRouteSelection();
    return;
  }

  if (window.confirm('ルート選択をすべて解除しますか？')) {
    clearRouteSelection();
  }
});
document.getElementById('openGoogleRoute').addEventListener('click', () => {
  const urls = buildGoogleMapsUrls();
  if (!urls.length) {
    alert('Google Mapsでルートを作るには、2駅以上を選択してください。');
    return;
  }
  window.open(urls[0], '_blank', 'noopener,noreferrer');
  if (urls.length > 1) alert(`地点数が多いため${urls.length}区間に分割しました。続きはパネル下部の区間リンクから開いてください。`);
});

initializeMobileView();
initializeFixedMarkers();

  } catch (error) {
    console.error('初期化エラー', error);
    statusEl.textContent = '初期化中にエラーが発生しました';
    loadingEl.textContent = '読み込みに失敗しました';
    document.getElementById('stationList').innerHTML = '<div style="padding:16px;line-height:1.7">初期化に失敗しました。Safariで開き直すか、ページを再読み込みしてください。</div>';
  }
})();
