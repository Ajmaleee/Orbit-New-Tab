/* scrip js ,aint no dawg be missing ts */

const LAYOUT_KEY = "newtab-layout-v1";
const SHORTCUTS_KEY = "newtab-shortcuts-v1";
const APOD_CACHE_KEY = "newtab-apod-cache-v1";

// yea this is sitting in plain text, anyone who opens devtools can see it.
// if ur reading ts, congrats,i have nothing to say
const APOD_API_KEY = "OsV2xalMFxC9KVUYekeO1pgWKiLp2qJr4V2WWof0";


/*  Clock updates every second, hopefully doesnt become a look like a time bomb */


const timeEl = document.getElementById("time");
const dateEl = document.getElementById("date");

function tickClock() {
  const now = new Date();

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  timeEl.textContent = `${hours}:${minutes}`;

  dateEl.textContent = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

tickClock();
// checking every second is lowky LARP for a clock that only shows minutes,
// but the day WILL eventually change and someone has to notice
setInterval(tickClock, 1000);

// unrelated but i will die on this hill: cereal is soup and nobody
// can convince me otherwise, moving on


/*  Edit mode yea ik u dumbass fihhh ed the layout             */

const editToggle = document.getElementById("edit-toggle");
const resetBtn = document.getElementById("reset-layout");
const board = document.getElementById("board");
const widgets = Array.from(document.querySelectorAll(".widget"));

let editMode = false;

editToggle.addEventListener("click", () => {
  editMode = !editMode;
  document.body.classList.toggle("edit-mode", editMode);
  editToggle.classList.toggle("active", editMode);
});

/*  Dragging ,me so nerdy ahh now it works with pens,mouse,touch     */


let activeWidget = null;
let pointerOffset = { x: 0, y: 0 };

// how many px of the bottom-right corner we hand off to the native
// resize handle instead of treating it as "start dragging". without
// this, grabbing the corner to resize would just yank the whole card
// across the screen instead, which defeats the point
const RESIZE_HANDLE_ZONE = 16;

function toPercent(px, axisSize) {
  return Math.min(100, Math.max(0, (px / axisSize) * 100));
}

function startDrag(e) {
  if (!editMode) return;

  const widget = e.currentTarget;      /* MIGUEL MIGUEL MIGUEL T_T */

  // if the pointer came down in the little corner square the browser
  // reserves for the resize grip, let the browser have it, don't
  // hijack it into a drag
  const rect = widget.getBoundingClientRect();
  const nearRight = rect.right - e.clientX < RESIZE_HANDLE_ZONE;
  const nearBottom = rect.bottom - e.clientY < RESIZE_HANDLE_ZONE;
  if (nearRight && nearBottom) return;

  activeWidget = widget;
  widget.classList.add("dragging");

  pointerOffset.x = e.clientX - (rect.left + rect.width / 2);
  pointerOffset.y = e.clientY - (rect.top + rect.height / 2);

  widget.setPointerCapture(e.pointerId);
}

function duringDrag(e) {
  if (!activeWidget) return;

  const boardRect = board.getBoundingClientRect();
  const x = e.clientX - boardRect.left - pointerOffset.x;
  const y = e.clientY - boardRect.top - pointerOffset.y;

  const leftPct = toPercent(x, boardRect.width);
  const topPct = toPercent(y, boardRect.height);

  activeWidget.style.left = `${leftPct}%`;
  activeWidget.style.top = `${topPct}%`;
}

function endDrag(e) {
  if (!activeWidget) return;

  activeWidget.classList.remove("dragging");
  saveWidgetPosition(activeWidget);
  activeWidget = null;
}

widgets.forEach((widget) => {
  widget.addEventListener("pointerdown", startDrag);
  widget.addEventListener("pointermove", duringDrag);
  widget.addEventListener("pointerup", endDrag);
  widget.addEventListener("pointercancel", endDrag);
});

/* resizing. CSS's `resize: both` gives us the drag handle for free but
   doesn't fire any kind of event when it's used, so ResizeObserver is
   the only way to actually notice it happened and save the new size */
const resizeObserver = new ResizeObserver((entries) => {
  entries.forEach((entry) => {
    // only persist sizes the user actually chose in edit mode, not
    // incidental layout shifts (font loading, window resize, etc)
    if (!editMode) return;
    saveWidgetSize(entry.target);
  });
});

widgets.forEach((widget) => resizeObserver.observe(widget));

function saveWidgetSize(widget) {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(LAYOUT_KEY)) || {};
  } catch {
    saved = {};
  }

  const id = widget.dataset.id;
  saved[id] = {
    ...(saved[id] || {}),
    width: Math.round(widget.offsetWidth),
    height: Math.round(widget.offsetHeight),
  };

  localStorage.setItem(LAYOUT_KEY, JSON.stringify(saved));
}

/*  localStorage, because re-arranging your clock every     */
/*  time you open a tab is a special lowky ahhh                         */

function loadLayout() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(LAYOUT_KEY)) || {};
  } catch {
    saved = {}; // corrupted json, someone probably hand-edited localStorage. respect.
  }

  widgets.forEach((widget) => {
    const id = widget.dataset.id;
    const pos = saved[id];
    if (!pos) return;

    if (pos.left != null) widget.style.left = `${pos.left}%`;
    if (pos.top != null) widget.style.top = `${pos.top}%`;
    if (pos.width != null) widget.style.width = `${pos.width}px`;
    if (pos.height != null) widget.style.height = `${pos.height}px`;
  });
}

function saveWidgetPosition(widget) {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(LAYOUT_KEY)) || {};
  } catch {
    saved = {};
  }

  saved[widget.dataset.id] = {
    ...(saved[widget.dataset.id] || {}),
    left: parseFloat(widget.style.left),
    top: parseFloat(widget.style.top),
  };

  localStorage.setItem(LAYOUT_KEY, JSON.stringify(saved));
}

resetBtn.addEventListener("click", () => {
  localStorage.removeItem(LAYOUT_KEY);
  // reload the defaults straight from the inline styles hard written ahh into the HTML
  widgets.forEach((widget) => {
    widget.removeAttribute("style");
  });
  location.reload(); // if it works,dont touch it yayayayayayayayayyayayay
});

loadLayout();


/* ===========================================================
   SHORTCUTS. aka the "sites u actually open every 5 minutes" wall.

   real "most visited sites" data only exists if this page is running
   as an actual browser extension new-tab override (chrome.topSites needs
   that permission + manifest). if we're just opening index.html raw,
   that api flat out doesn't exist, no cap. so heres the deal:

   - if chrome.topSites is there -> use the real deal, autopopulate
   - if not -> fall back to a lil starter pack u can edit yourself,
     add/remove whatever, we remember it in localStorage forever
   =========================================================== */

const shortcutsGrid = document.getElementById("shortcuts-grid");

const DEFAULT_SHORTCUTS = [
  { name: "YouTube", url: "https://youtube.com" },
  { name: "GitHub", url: "https://github.com" },
  { name: "Reddit", url: "https://reddit.com" },
];

function faviconFor(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return ""; // garbage url in, garbage icon out, we dont judge
  }
}

function loadShortcuts() {
  try {
    const saved = JSON.parse(localStorage.getItem(SHORTCUTS_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    /* corrupted, just fall through to defaults below */
  }
  return DEFAULT_SHORTCUTS;
}

function saveShortcuts(list) {
  localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(list));
}

function renderShortcuts(list) {
  shortcutsGrid.innerHTML = "";

  list.forEach((site, index) => {
    const tile = document.createElement("a");
    tile.className = "shortcut-tile";
    tile.href = site.url;
    tile.target = "_self";

    tile.innerHTML = `
      <button class="shortcut-remove" title="yeet this one" data-index="${index}">×</button>
      <span class="shortcut-icon"><img src="${faviconFor(site.url)}" alt="" /></span>
      <span class="shortcut-label">${site.name}</span>
    `;

    shortcutsGrid.appendChild(tile);
  });

  // the "+" tile, forever at the end, forever ready
  const addTile = document.createElement("button");
  addTile.className = "shortcut-tile shortcut-add";
  addTile.innerHTML = `
    <span class="shortcut-icon">+</span>
    <span class="shortcut-label">add</span>
  `;
  addTile.addEventListener("click", handleAddShortcut);
  shortcutsGrid.appendChild(addTile);

  // hook up all the little x buttons we just spawned
  shortcutsGrid.querySelectorAll(".shortcut-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault(); // dont navigate the parent <a>, we're deleting not visiting
      e.stopPropagation();
      const idx = Number(btn.dataset.index);
      const current = loadShortcuts();
      current.splice(idx, 1);
      saveShortcuts(current);
      renderShortcuts(current);
    });
  });
}

function handleAddShortcut() {
  const url = prompt("drop the URL (with https:// and everything):");
  if (!url) return;

  const name = prompt("what do we call this one?", new URL(url).hostname.replace("www.", ""));
  const current = loadShortcuts();
  current.push({ name: name || "untitled", url });
  saveShortcuts(current);
  renderShortcuts(current);
}

// try the real browser API first, no shame in falling back if it's not there
function initShortcuts() {
  if (typeof chrome !== "undefined" && chrome.topSites && chrome.topSites.get) {
    chrome.topSites.get((sites) => {
      const mapped = sites.slice(0, 8).map((s) => ({ name: s.title || s.url, url: s.url }));
      renderShortcuts(mapped.length ? mapped : loadShortcuts());
    });
  } else {
    renderShortcuts(loadShortcuts());
  }
}

initShortcuts();

// deeply unrelated: whoever invented the concept of "reply all" owes
// the entire working world an apology and possibly reparations


/* ===========================================================
   AI TOOLS flyout, bottom left. click to open, click elsewhere to close,
   the way every dropdown on earth is legally required to behave
   =========================================================== */

const aiToggle = document.getElementById("ai-tools-toggle");
const aiPanel = document.getElementById("ai-tools-panel");

aiToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = aiPanel.classList.toggle("open");
  aiToggle.classList.toggle("active", isOpen);
});

// clicking literally anywhere else closes it, standard dropdown etiquette
document.addEventListener("click", (e) => {
  if (!aiPanel.contains(e.target) && e.target !== aiToggle) {
    aiPanel.classList.remove("open");
    aiToggle.classList.remove("active");
  }
});


/* ===========================================================
   NASA APOD (astronomy picture of the day). grabs todays photo,
   slaps it on the background, and feeds the info pill everything
   it needs. cached per-day so opening 40 tabs doesnt burn 40 calls.
   =========================================================== */

const apodBg = document.getElementById("apod-bg");
const infoToggle = document.getElementById("apod-info-toggle");
const infoLabel = document.getElementById("apod-info-label");
const infoPanel = document.getElementById("apod-info-panel");
const titleEl = document.getElementById("apod-title");
const dateLineEl = document.getElementById("apod-date-line");
const explanationEl = document.getElementById("apod-explanation");
const copyrightEl = document.getElementById("apod-copyright");
const hdLink = document.getElementById("apod-hd-link");

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, good enough to compare "same day"
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

function applyAPOD(data) {
  // images set the bg directly. videos dont have a photo, so we use NASA's
  // own thumbnail if they gave us one (thumbs=true in the request below)
  const imageUrl = data.media_type === "image" ? (data.hdurl || data.url) : data.thumbnail_url;

  if (imageUrl) {
    apodBg.style.backgroundImage = `url("${imageUrl}")`;
  }
  // no imageUrl (rare, video w/ no thumbnail)? #apod-bg just keeps its
  // solid --bg color, nobody's the wiser

  titleEl.textContent = data.title || "today's mystery photo";
  infoLabel.textContent = data.title ? truncate(data.title, 24) : "photo info";

  const niceDate = new Date(`${data.date}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  dateLineEl.textContent = data.media_type === "video" ? `${niceDate} · video` : niceDate;

  explanationEl.textContent = data.explanation || "NASA forgot to write a caption today, couldn't tell u why.";

  copyrightEl.textContent = data.copyright
    ? `© ${data.copyright.trim()}`
    : "public domain, courtesy NASA";

  const linkUrl = data.hdurl || data.url;
  if (linkUrl) {
    hdLink.href = linkUrl;
    hdLink.style.display = "inline";
    hdLink.textContent = data.media_type === "video" ? "watch it ↗" : "view full res ↗";
  }
}

async function fetchAPOD() {
  const today = todayStr();

  // check the cache first, zero reason to hit NASA's servers every single
  // time someone opens a new tab, they only update this thing once a day anyway
  try {
    const cached = JSON.parse(localStorage.getItem(APOD_CACHE_KEY));
    if (cached && cached.date === today && cached.data) {
      applyAPOD(cached.data);
      return;
    }
  } catch {
    /* cache corrupted somehow, whatever, just fetch fresh below */
  }

  try {
    const res = await fetch(
      `https://api.nasa.gov/planetary/apod?api_key=${APOD_API_KEY}&thumbs=true`
    );
    if (!res.ok) throw new Error(`NASA said no: ${res.status}`);

    const data = await res.json();
    localStorage.setItem(APOD_CACHE_KEY, JSON.stringify({ date: today, data }));
    applyAPOD(data);
  } catch (err) {
    console.warn("APOD fetch flopped:", err);
    infoLabel.textContent = "couldn't reach NASA rn";
    explanationEl.textContent =
      "the fetch didn't come through so the background's staying plain today. probably rate limited or you're offline, try again later.";
  }
}

fetchAPOD();

infoToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = infoPanel.classList.toggle("open");
  infoToggle.classList.toggle("active", isOpen);
});

document.addEventListener("click", (e) => {
  if (!infoPanel.contains(e.target) && e.target !== infoToggle) {
    infoPanel.classList.remove("open");
    infoToggle.classList.remove("active");
  }
});

// if you scrolled all the way down here looking for more unhinged
// comments: same energy as checking the fridge a 4th time hoping
// something new appeared. there is nothing left. go touch grass
