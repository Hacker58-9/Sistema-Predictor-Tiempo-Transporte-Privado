// ──────────────────────────────────────────
// MAP SETUP — centrado en Trujillo, Perú
// ──────────────────────────────────────────
const map = L.map('map', { zoomControl: true }).setView([-8.1116, -79.0288], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
  maxZoom: 19
}).addTo(map);

// Custom dot icons
const makeIcon = (color) => L.divIcon({
  html: `<div style="
    width:16px;height:16px;
    background:${color};
    border:3px solid rgba(255,255,255,0.95);
    border-radius:50%;
    box-shadow:0 2px 8px rgba(0,0,0,0.55);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  className: ''
});

const icons = {
  origin:      makeIcon('#22c55e'),
  destination: makeIcon('#ef4444')
};

let clickMode   = 'origin';
let markers     = { origin: null, destination: null };
let routeLayer  = null;   // GeoJSON layer for the real road route
let suppressSync = false;

// ──────────────────────────────────────────
// MODE TOGGLE
// ──────────────────────────────────────────
function setMode(mode) {
  clickMode = mode;
  document.getElementById('badge-origin').classList.toggle('active', mode === 'origin');
  document.getElementById('badge-dest').classList.toggle('active', mode === 'destination');
  document.getElementById('map-hint').innerHTML = mode === 'origin'
    ? '📍 Haz clic para fijar el <strong>origen</strong>'
    : '🏁 Haz clic para fijar el <strong>destino</strong>';
}

// ──────────────────────────────────────────
// PLACE MARKER
// ──────────────────────────────────────────
function placeMarker(lat, lng, type, fromInput = false) {
  if (markers[type]) map.removeLayer(markers[type]);

  markers[type] = L.marker([lat, lng], {
    icon: icons[type],
    draggable: true
  }).addTo(map)
    .bindPopup(type === 'origin' ? '📍 Origen' : '🏁 Destino')
    .openPopup();

  markers[type].on('dragend', (e) => {
    const { lat: dLat, lng: dLng } = e.target.getLatLng();
    writeInputs(dLat, dLng, type);
    fetchRoute();
    refreshBadges();
  });

  if (!fromInput) writeInputs(lat, lng, type);

  fetchRoute();
  refreshBadges();
  autoSetDatetime();
}

function writeInputs(lat, lng, type) {
  suppressSync = true;
  if (type === 'origin') {
    document.getElementById('orig-lat').value = lat.toFixed(6);
    document.getElementById('orig-lon').value = lng.toFixed(6);
  } else {
    document.getElementById('dest-lat').value = lat.toFixed(6);
    document.getElementById('dest-lon').value = lng.toFixed(6);
  }
  suppressSync = false;
}

function refreshBadges() {
  const oLat = document.getElementById('orig-lat').value;
  const oLon = document.getElementById('orig-lon').value;
  const dLat = document.getElementById('dest-lat').value;
  const dLon = document.getElementById('dest-lon').value;

  if (oLat && oLon) {
    const el = document.getElementById('badge-orig-text');
    el.textContent = `${(+oLat).toFixed(4)}, ${(+oLon).toFixed(4)}`;
    el.classList.add('set');
    document.getElementById('badge-origin').classList.add('placed');
  }
  if (dLat && dLon) {
    const el = document.getElementById('badge-dest-text');
    el.textContent = `${(+dLat).toFixed(4)}, ${(+dLon).toFixed(4)}`;
    el.classList.add('set');
    document.getElementById('badge-dest').classList.add('placed');
  }
}

// ──────────────────────────────────────────
// REAL-ROAD ROUTE via OSRM (gratuito, sin API key)
// Docs: https://project-osrm.org/docs/v5.24.0/api/
// ──────────────────────────────────────────
let routeAbort = null; // AbortController to cancel pending requests

async function fetchRoute() {
  const oLat = parseFloat(document.getElementById('orig-lat').value);
  const oLon = parseFloat(document.getElementById('orig-lon').value);
  const dLat = parseFloat(document.getElementById('dest-lat').value);
  const dLon = parseFloat(document.getElementById('dest-lon').value);

  // Clear existing route
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }

  if (isNaN(oLat) || isNaN(oLon) || isNaN(dLat) || isNaN(dLon)) return;
  if (oLat === dLat && oLon === dLon) return;

  // Cancel any in-flight request
  if (routeAbort) routeAbort.abort();
  routeAbort = new AbortController();

  showRouteLoading(true);

  try {
    // OSRM public demo server — coordinates as lon,lat
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${oLon},${oLat};${dLon},${dLat}` +
      `?overview=full&geometries=geojson&steps=false`;

    const resp = await fetch(url, { signal: routeAbort.signal });
    if (!resp.ok) throw new Error('OSRM HTTP error ' + resp.status);

    const data = await resp.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      // Fallback: straight dashed line if no road route found
      drawFallbackLine(oLat, oLon, dLat, dLon);
      return;
    }

    const route = data.routes[0];
    const geojson = route.geometry; // GeoJSON LineString

    // Store OSRM distance & duration for use in prediction
    window._osrmDistance = route.distance / 1000; // meters → km
    window._osrmDuration = route.duration / 60;   // seconds → minutes

    // Draw the route
    routeLayer = L.geoJSON(geojson, {
      style: {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }
    }).addTo(map);

    // Fit map to route bounds
    map.fitBounds(routeLayer.getBounds(), { padding: [55, 55], maxZoom: 16 });

  } catch (err) {
    if (err.name === 'AbortError') return; // Cancelled — silent
    console.warn('OSRM error, using fallback:', err);
    drawFallbackLine(oLat, oLon, dLat, dLon);
  } finally {
    showRouteLoading(false);
  }
}

// Dashed straight line if OSRM fails
function drawFallbackLine(oLat, oLon, dLat, dLon) {
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  routeLayer = L.polyline(
    [[oLat, oLon], [dLat, dLon]],
    { color: '#64748b', weight: 2, dashArray: '8, 6', opacity: 0.65 }
  ).addTo(map);
  map.fitBounds(routeLayer.getBounds(), { padding: [55, 55], maxZoom: 16 });
  window._osrmDistance = null;
  window._osrmDuration = null;
}

function showRouteLoading(show) {
  document.getElementById('route-loading').classList.toggle('hidden', !show);
}

// ──────────────────────────────────────────
// MAP CLICK → place marker, auto-switch mode
// ──────────────────────────────────────────
map.on('click', (e) => {
  const { lat, lng } = e.latlng;
  placeMarker(lat, lng, clickMode);
  setMode(clickMode === 'origin' ? 'destination' : 'origin');
});

// ──────────────────────────────────────────
// MANUAL INPUT → update map
// ──────────────────────────────────────────
['orig-lat', 'orig-lon', 'dest-lat', 'dest-lon'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    if (suppressSync) return;

    const oLat = parseFloat(document.getElementById('orig-lat').value);
    const oLon = parseFloat(document.getElementById('orig-lon').value);
    const dLat = parseFloat(document.getElementById('dest-lat').value);
    const dLon = parseFloat(document.getElementById('dest-lon').value);

    if (id.startsWith('orig') && !isNaN(oLat) && !isNaN(oLon))
      placeMarker(oLat, oLon, 'origin', true);

    if (id.startsWith('dest') && !isNaN(dLat) && !isNaN(dLon))
      placeMarker(dLat, dLon, 'destination', true);

    refreshBadges();
    autoSetDatetime();
  });
});

// ──────────────────────────────────────────
// ADDRESS SEARCH via Nominatim
// ──────────────────────────────────────────
document.getElementById('search-btn').addEventListener('click', searchAddress);
document.getElementById('search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); searchAddress(); }
});

async function searchAddress() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;

  const el = document.getElementById('search-results');
  el.innerHTML = '<p style="font-size:0.73rem;color:#475569;margin-top:0.4rem;">Buscando…</p>';

  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=4&countrycodes=pe`,
      { headers: { 'Accept-Language': 'es' } }
    );
    const data = await resp.json();

    if (!data.length) {
      el.innerHTML = '<p style="font-size:0.73rem;color:#ef4444;margin-top:0.4rem;">Sin resultados. Intenta ser más específico.</p>';
      return;
    }

    el.innerHTML = data.map(r => {
      const label = r.display_name.split(',').slice(0, 3).join(', ');
      return `<div class="result-item" onclick="applyResult(${r.lat}, ${r.lon})">${label}</div>`;
    }).join('');
  } catch {
    el.innerHTML = '<p style="font-size:0.73rem;color:#ef4444;margin-top:0.4rem;">Error de red. Comprueba tu conexión.</p>';
  }
}

function applyResult(lat, lng) {
  placeMarker(+lat, +lng, clickMode);
  map.setView([+lat, +lng], 15);
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-input').value = '';
  setMode(clickMode === 'origin' ? 'destination' : 'origin');
}

// ──────────────────────────────────────────
// DATETIME
// ──────────────────────────────────────────
function localNow() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function autoSetDatetime() {
  const dt = document.getElementById('trip-datetime');
  if (!dt.value) dt.value = localNow();
}

// ──────────────────────────────────────────
// TRAFFIC MODEL
// ──────────────────────────────────────────
function getTraffic(datetimeStr) {
  const d    = new Date(datetimeStr);
  const h    = d.getHours();
  const wday = d.getDay();
  const isWeekend = wday === 0 || wday === 6;

  if (!isWeekend && h >= 7  && h <= 9)  return { factor: 1.55, label: 'Hora punta — mañana',  level: 'high'   };
  if (!isWeekend && h >= 17 && h <= 20) return { factor: 1.65, label: 'Hora punta — tarde',    level: 'high'   };
  if (h >= 12 && h <= 14)               return { factor: isWeekend ? 1.1 : 1.3, label: 'Hora de almuerzo', level: 'medium' };
  if (h >= 22 || h <= 5)               return { factor: 0.85, label: 'Tráfico fluido — noche', level: 'low'    };
  if (isWeekend)                        return { factor: 1.0,  label: 'Fin de semana',           level: 'low'    };
  return                                       { factor: 1.2,  label: 'Tráfico normal',          level: 'medium' };
}

// ──────────────────────────────────────────
// FORM SUBMIT
// ──────────────────────────────────────────
document.getElementById('prediction-form').addEventListener('submit', (e) => {
  e.preventDefault();

  const oLat  = parseFloat(document.getElementById('orig-lat').value);
  const oLon  = parseFloat(document.getElementById('orig-lon').value);
  const dLat  = parseFloat(document.getElementById('dest-lat').value);
  const dLon  = parseFloat(document.getElementById('dest-lon').value);
  const dtStr = document.getElementById('trip-datetime').value || localNow();

  if ([oLat, oLon, dLat, dLon].some(isNaN)) {
    alert('Completa las coordenadas de origen y destino antes de estimar.');
    return;
  }
  if (oLat === dLat && oLon === dLon) {
    alert('El origen y el destino son el mismo punto.');
    return;
  }

  const traffic = getTraffic(dtStr);

  let distKm, minutes, distLabel;

  if (window._osrmDistance && window._osrmDuration) {
    // Use real road distance & OSRM free-flow time, then apply traffic factor
    distKm   = window._osrmDistance;
    minutes  = Math.round(window._osrmDuration * traffic.factor);
    distLabel = `Distancia por carretera: ${distKm.toFixed(2)} km`;
  } else {
    // Fallback: haversine straight-line
    distKm  = haversine(oLat, oLon, dLat, dLon);
    const avgKmh = 25 / traffic.factor;
    minutes = Math.round((distKm / avgKmh) * 60);
    distLabel = `Distancia en línea recta: ${distKm.toFixed(2)} km`;
  }

  // Format duration
  let durText, durUnit;
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    durText = m > 0 ? `${h}h ${m}m` : `${h}h`;
    durUnit = '';
  } else {
    durText = `${minutes}`;
    durUnit = minutes === 1 ? 'minuto' : 'minutos';
  }

  const avgSpeed = Math.round(distKm / (minutes / 60));
  const levelEmoji = { low: '🟢', medium: '🟡', high: '🔴' };

  document.getElementById('duration-text').textContent   = durText;
  document.getElementById('duration-unit').textContent   = durUnit;
  document.getElementById('distance-text').textContent   = distLabel;
  document.getElementById('traffic-indicator').innerHTML =
    `<span class="traffic-pill ${traffic.level}">${levelEmoji[traffic.level]} ${traffic.label}</span>`;
  document.getElementById('speed-note').textContent =
    `Velocidad media estimada: ${avgSpeed} km/h`;

  const resultEl = document.getElementById('result');
  resultEl.classList.remove('hidden');
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// ──────────────────────────────────────────
// HAVERSINE (fallback distance)
// ──────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toR = x => x * Math.PI / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ──────────────────────────────────────────
// RESET
// ──────────────────────────────────────────
document.getElementById('new-prediction').addEventListener('click', () => {
  document.getElementById('result').classList.add('hidden');
  document.getElementById('prediction-form').reset();
  document.getElementById('trip-datetime').value = localNow();

  Object.values(markers).forEach(m => m && map.removeLayer(m));
  markers = { origin: null, destination: null };
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }

  window._osrmDistance = null;
  window._osrmDuration = null;

  ['badge-orig-text', 'badge-dest-text'].forEach(id => {
    const el = document.getElementById(id);
    el.textContent = 'Sin seleccionar';
    el.classList.remove('set');
  });
  document.getElementById('badge-origin').classList.remove('placed');
  document.getElementById('badge-dest').classList.remove('placed');
  document.getElementById('search-results').innerHTML = '';

  map.setView([-8.1116, -79.0288], 13);
  setMode('origin');
});

// ──────────────────────────────────────────
// LOGOUT
// ──────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', () => {
  window.location.href = 'auth.html';
});

// ──────────────────────────────────────────
// INIT
// ──────────────────────────────────────────
document.getElementById('trip-datetime').value = localNow();
setMode('origin');