/* Ghost Forest Atlas — Leaflet front-end (static XYZ tiles) */

// ---------------------------------------------------------------- basemaps
const basemaps = {
  streets: L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    }
  ),
  satellite: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
    }
  ),
};

// ---------------------------------------------------------------- data layers
// Legends use CSS gradients matching the baked-in palettes.
const REDS = "#fee0d2,#fcbba1,#fc9272,#fb6a4a,#ef3b2c,#cb181d,#a50f15,#67000d";
const VIRIDIS = "#440154,#414487,#2a788e,#22a884,#7ad151,#fde725";
const GRAY = "#000000,#ffffff";

// optional ?layers=mortality,dem to preset which layers start visible
const layerParam = new URLSearchParams(location.search).get("layers");
const forcedOn = layerParam ? new Set(layerParam.split(",").map((s) => s.trim())) : null;

const LAYERS = [
  {
    id: "mortality",
    name: "Mortality rate",
    desc: "All coastal area",
    on: true,
    z: 440,
    maxNative: 10,
    legend: { grad: REDS, ticks: ["0", "2.5", "5+"], unit: "trees ha⁻¹ yr⁻¹" },
  },
  {
    id: "wetland",
    name: "Mortality rate (wetland)",
    desc: "Forested wetland only",
    on: false,
    z: 435,
    maxNative: 10,
    legend: { grad: REDS, ticks: ["0", "2.5", "5+"], unit: "trees ha⁻¹ yr⁻¹" },
  },
  {
    id: "uncertainty",
    name: "Confidence",
    desc: "Average years of observations",
    on: false,
    z: 420,
    maxNative: 10,
    legend: { grad: VIRIDIS, ticks: ["1", "2", "3+"], unit: "obs. years" },
  },
  {
    id: "dem",
    name: "Elevation",
    desc: "meters above sea / lake levels",
    on: false,
    z: 410,
    maxNative: 9,
    legend: { grad: GRAY, ticks: ["0", "", "5+"], unit: "meters" },
  },
];

const TILE_OPTS = (l) => ({
  minNativeZoom: 2,
  maxNativeZoom: l.maxNative, // upscale (overzoom) past native instead of going blank
  maxZoom: 19,
  opacity: 1,
  pane: "pane_" + l.z,
  className: "data-tile", // crisp 100 m pixels when overzoomed (see style.css)
  // full data extent (from the MBTiles metadata, with a small margin). The old
  // value cut off everything east of -73.5 / north of 48.5 — i.e. Maine, Cape
  // Cod, eastern Long Island — so their tiles never loaded.
  bounds: L.latLngBounds([22, -129], [52, -64]),
});

// ---------------------------------------------------------------- map init
// optional shareable state from URL hash: #zoom/lat/lng
function parseHash() {
  const m = location.hash.match(/^#(\d+(?:\.\d+)?)\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/);
  return m ? { zoom: +m[1], center: [+m[2], +m[3]] } : null;
}
const start = parseHash() || { center: [33.5, -80.0], zoom: 5 };

const map = L.map("map", {
  center: start.center,
  zoom: start.zoom,
  minZoom: 3,
  maxZoom: 19,
  zoomControl: false,
  preferCanvas: false,
});

let hashTimer;
map.on("moveend", () => {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const c = map.getCenter();
    history.replaceState(null, "", `#${map.getZoom()}/${c.lat.toFixed(4)}/${c.lng.toFixed(4)}`);
  }, 300);
});
L.control.zoom({ position: "bottomright" }).addTo(map);

let currentBase =
  new URLSearchParams(location.search).get("base") === "satellite"
    ? "satellite"
    : "streets";
basemaps[currentBase].addTo(map);
document.querySelectorAll("#basemapSwitch button").forEach((b) =>
  b.classList.toggle("active", b.dataset.base === currentBase)
);

// dedicated panes so data stacking is independent of toggle order
LAYERS.forEach((l) => {
  map.createPane("pane_" + l.z);
  map.getPane("pane_" + l.z).style.zIndex = l.z;
});

// instantiate tile layers — read straight from the per-layer PMTiles archives
// (static files, no server needed: the browser fetches byte ranges on demand)
LAYERS.forEach((l) => {
  if (forcedOn) l.on = forcedOn.has(l.id);
  const archive = new pmtiles.PMTiles("data/" + l.id + ".pmtiles");
  l.layer = pmtiles.leafletRasterLayer(archive, TILE_OPTS(l));
  if (l.on) l.layer.addTo(map);
});

// ---------------------------------------------------------------- basemap UI
document.querySelectorAll("#basemapSwitch button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const base = btn.dataset.base;
    if (base === currentBase) return;
    map.removeLayer(basemaps[currentBase]);
    basemaps[base].addTo(map);
    basemaps[base].bringToBack();
    currentBase = base;
    document
      .querySelectorAll("#basemapSwitch button")
      .forEach((b) => b.classList.toggle("active", b === btn));
  });
});

// ---------------------------------------------------------------- layer UI
const container = document.getElementById("layers");
LAYERS.forEach((l) => {
  const card = document.createElement("div");
  card.className = "layer" + (l.on ? " on" : "");
  card.innerHTML = `
    <div class="layer-head">
      <div class="layer-title">
        <div class="name">${l.name}</div>
        <div class="desc">${l.desc}</div>
      </div>
      <label class="switch">
        <input type="checkbox" ${l.on ? "checked" : ""}>
        <span class="track"></span><span class="thumb"></span>
      </label>
    </div>
    <div class="layer-body">
      <div class="legend">
        <div class="bar" style="background:linear-gradient(90deg, ${l.legend.grad})"></div>
        <div class="ticks">${l.legend.ticks.map((t) => `<span>${t}</span>`).join("")}</div>
        <div class="unit">${l.legend.unit}</div>
      </div>
      <div class="opacity-row">
        <label>Opacity</label>
        <input type="range" min="0" max="100" value="100">
      </div>
    </div>`;

  const checkbox = card.querySelector('input[type="checkbox"]');
  const slider = card.querySelector('input[type="range"]');

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      l.layer.addTo(map);
      card.classList.add("on");
    } else {
      map.removeLayer(l.layer);
      card.classList.remove("on");
    }
  });
  slider.addEventListener("input", () => l.layer.setOpacity(slider.value / 100));

  container.appendChild(card);
});

// ---------------------------------------------------------------- panel collapse
const panel = document.getElementById("panel");
const toggle = document.getElementById("panelToggle");
const reopen = document.createElement("button");
reopen.className = "reopen";
reopen.innerHTML = "&#9776;";
reopen.title = "Show panel";
document.body.appendChild(reopen);

toggle.addEventListener("click", () => {
  panel.classList.add("collapsed");
  reopen.classList.add("show");
});
reopen.addEventListener("click", () => {
  panel.classList.remove("collapsed");
  reopen.classList.remove("show");
});

// ---------------------------------------------------------------- place search
// Free OpenStreetMap Nominatim geocoder (no API key). Debounced autocomplete;
// click a result (or press Enter) to fly the map there.
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
let searchTimer;

function clearResults() {
  searchResults.innerHTML = "";
}

function showMessage(msg) {
  searchResults.innerHTML = `<li class="empty">${msg}</li>`;
}

function flyToResult(r) {
  const [s, n, w, e] = r.boundingbox.map(Number); // [south, north, west, east]
  map.flyToBounds([[s, w], [n, e]], { maxZoom: 11, duration: 1.2 });
}

function renderResults(list) {
  if (!list.length) {
    showMessage("No matches found");
    return;
  }
  clearResults();
  list.forEach((r) => {
    const parts = r.display_name.split(",").map((p) => p.trim());
    const li = document.createElement("li");
    li.innerHTML =
      `<div class="title">${parts[0]}</div>` +
      `<div class="sub">${parts.slice(1, 4).join(", ")}</div>`;
    li.addEventListener("click", () => {
      flyToResult(r);
      searchInput.value = parts[0];
      clearResults();
    });
    searchResults.appendChild(li);
  });
}

async function runSearch(q) {
  if (!q || q.length < 3) {
    clearResults();
    return;
  }
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=5&q=" +
      encodeURIComponent(q);
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    renderResults(await res.json());
  } catch (err) {
    showMessage("Search unavailable (offline?)");
  }
}

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runSearch(searchInput.value.trim()), 350);
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const first = searchResults.querySelector("li:not(.empty)");
    if (first) first.click();
    else runSearch(searchInput.value.trim());
  } else if (e.key === "Escape") {
    clearResults();
    searchInput.blur();
  }
});
// close the dropdown when clicking elsewhere
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search")) clearResults();
});

// optional ?q=<place> deep link: open already zoomed to that place
const qParam = new URLSearchParams(location.search).get("q");
if (qParam) {
  searchInput.value = qParam;
  fetch(
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
      encodeURIComponent(qParam)
  )
    .then((r) => r.json())
    .then((d) => {
      if (d.length) flyToResult(d[0]);
    })
    .catch(() => {});
}
