/* ============================================================
   Sawtooth Ridge Cabins — demo engine (powered by Keepprz)
   No backend. Listings, availability + pricing all run client-side.
   ============================================================ */

const BRAND = {
  name: "Sawtooth Ridge Cabins",
  initials: "SR",
  host: "Dana & Mark Hollis",
  town: "Stanley, Idaho",
  email: "stay@sawtoothridge.example",
  phone: "(208) 555-0147",
  taxRate: 0.08,            // ID lodging + local, illustrative
};

const U = (id, w=1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const LOCAL = f => `assets/img/${f}`;

/* ---- the "properties" table (what Keepprz would store per tenant) ---- */
const LISTINGS = [
  {
    id:"redfish", name:"The Redfish A-Frame",
    tagline:"Classic A-frame steps from Redfish Lake",
    location:"Redfish Lake, Stanley ID", type:"A-frame cabin",
    guests:6, beds:3, baths:2, nightly:289, cleaning:120, rating:4.97, reviews:142,
    blurb:"A light-filled A-frame under the Sawtooths — wood stove, full kitchen, and the lake a 5-minute walk away.",
    longDesc:"Wake up to peaks out every window. This restored A-frame sleeps six across three bedrooms, with a wood stove for cool evenings, a fully stocked kitchen, and a wraparound deck made for morning coffee. Redfish Lake — swimming, paddleboards, the lodge — is a short walk down the path. Trailheads start at the end of the road.",
    amenities:["Fast Wi-Fi","Full kitchen","Wood-burning stove","Wraparound deck","Free parking","Washer & dryer","5 min to Redfish Lake","Dogs welcome"],
    images:[U("1449158743715-0a90ebb6d2d8"), LOCAL("keepprz-hero-home.jpg"), U("1586023492125-27b2c045efd7"), LOCAL("keepprz-detail-linens.jpg"), U("1505691938895-1758d7feb511")],
    booked:[["2026-06-12","2026-06-15"],["2026-07-03","2026-07-07"]],
  },
  {
    id:"sawtooth-lodge", name:"Sawtooth Lodge",
    tagline:"Big-group lodge with hot tub & mountain views",
    location:"Stanley Basin, Stanley ID", type:"Whole lodge",
    guests:10, beds:5, baths:3, nightly:465, cleaning:185, rating:4.92, reviews:88,
    blurb:"Five bedrooms, a great room with a stone fireplace, and a hot tub pointed straight at the Sawtooth range.",
    longDesc:"Built for reunions and crews. The great room centers on a floor-to-ceiling stone fireplace, the kitchen seats everyone, and the deck hot tub looks out on the whole Sawtooth skyline. Five bedrooms, three baths, and enough space that nobody's on top of anyone. Twenty minutes to whitewater on the Salmon.",
    amenities:["Hot tub","Stone fireplace","Chef's kitchen","Sleeps 10","Fast Wi-Fi","Game room","Mountain views","EV charger"],
    images:[U("1542718610-a1d656d1884c"), U("1564013799919-ab600027ffc6"), LOCAL("keepprz-turnover-room.jpg"), U("1502672260266-1c1ef2d93688"), LOCAL("keepprz-detail-coffee.jpg")],
    booked:[["2026-06-20","2026-06-24"]],
  },
  {
    id:"salmon-studio", name:"Salmon River Studio",
    tagline:"Cozy riverfront studio for two",
    location:"Lower Stanley, Stanley ID", type:"Studio cabin",
    guests:2, beds:1, baths:1, nightly:159, cleaning:75, rating:4.99, reviews:204,
    blurb:"A snug studio right on the Salmon — fall asleep to the river, fish from the back step.",
    longDesc:"The whole place is one warm room done right: a queen bed, a little kitchenette, and big windows over the Salmon River. Step out the back and you're on the water. Perfect for a couple's getaway, and an easy stroll to Lower Stanley's cafés and the hot springs road.",
    amenities:["Riverfront","Wi-Fi","Kitchenette","Queen bed","Free parking","Fire pit","Near hot springs","Self check-in"],
    images:[U("1551882547-ff40c63fe5fa"), LOCAL("keepprz-detail-coffee.jpg"), U("1505691938895-1758d7feb511"), LOCAL("keepprz-detail-keys.jpg")],
    booked:[["2026-06-18","2026-06-20"],["2026-08-01","2026-08-05"]],
  },
  {
    id:"pinegrove", name:"Pinegrove Bungalow",
    tagline:"Family bungalow tucked in the pines",
    location:"Stanley, Idaho", type:"2-bed bungalow",
    guests:4, beds:2, baths:1, nightly:205, cleaning:95, rating:4.95, reviews:117,
    blurb:"A bright two-bedroom in the trees — fenced yard, fire pit, and an easy walk into town.",
    longDesc:"An easygoing family base camp. Two bedrooms, a sunny living room, a fenced yard the kids (and dog) can run in, and a fire pit for s'mores after a day on the trail. Walk into Stanley for breakfast, drive to a half-dozen alpine lakes. Simple, comfortable, and close to everything.",
    amenities:["Fenced yard","Fire pit","Full kitchen","Wi-Fi","Dogs welcome","Walk to town","Free parking","Pack-n-play"],
    images:[U("1469022563428-aa04fef9f5a2"), U("1586023492125-27b2c045efd7"), LOCAL("keepprz-detail-linens.jpg"), U("1502672260266-1c1ef2d93688")],
    booked:[["2026-07-10","2026-07-14"]],
  },
];

const getListing = id => LISTINGS.find(l => l.id === id);

/* ----------------------- date / pricing ----------------------- */
const DAY = 86400000;
function toDate(s){ if(!s) return null; const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function nights(ci,co){ const a=toDate(ci),b=toDate(co); if(!a||!b) return 0; return Math.round((b-a)/DAY); }
function fmtNice(s){ const d=toDate(s); return d? d.toLocaleDateString("en-US",{month:"short",day:"numeric"}) : ""; }
function money(n){ return "$"+Math.round(n).toLocaleString("en-US"); }
function todayISO(){ return new Date().toISOString().slice(0,10); }

function rangesOverlap(ci,co,bStart,bEnd){
  const a=toDate(ci),b=toDate(co),s=toDate(bStart),e=toDate(bEnd);
  return a < e && b > s;            // half-open overlap
}
function isAvailable(listing, ci, co){
  if(!ci||!co||nights(ci,co)<1) return null;
  return !listing.booked.some(([s,e]) => rangesOverlap(ci,co,s,e));
}
function quote(listing, ci, co){
  const n = nights(ci,co);
  const lodging = n * listing.nightly;
  const cleaning = listing.cleaning;
  const tax = Math.round((lodging) * BRAND.taxRate);
  const total = lodging + cleaning + tax;
  return { nights:n, nightly:listing.nightly, lodging, cleaning, tax, total };
}

/* ----------------------- booking state ----------------------- */
function saveBooking(obj){ sessionStorage.setItem("sr_booking", JSON.stringify(obj)); }
function loadBooking(){ try{ return JSON.parse(sessionStorage.getItem("sr_booking")); }catch(e){ return null; } }
function genCode(){ return "SR-" + Math.random().toString(36).slice(2,7).toUpperCase(); }

/* ----------------------- page chrome ----------------------- */
function mountChrome(active){
  const ribbon = `<div class="demo-ribbon">⌁ <b>Live demo</b> — this is an example direct-booking site built &amp; run by <b>Keepprz</b>. Book away, no card is charged. <a href="dashboard.html">See the owner's view →</a></div>`;
  const header = `
  <header class="site-header"><div class="wrap">
    <a class="brand" href="index.html"><span class="mark">${BRAND.initials}</span> ${BRAND.name}</a>
    <nav class="nav">
      <a class="navlink ${active==='stays'?'on':''}" href="index.html#stays">Cabins</a>
      <a class="navlink ${active==='activities'?'on':''}" href="activities.html">Things to do</a>
      <a class="navlink" href="index.html#about">Our story</a>
      <a class="btn btn-primary" href="index.html#stays">Book direct</a>
    </nav>
  </div></header>`;
  const slot = document.getElementById("chrome-top");
  if(slot) slot.innerHTML = ribbon + header;

  const footer = `
  <footer class="site-footer"><div class="wrap">
    <div class="cols">
      <div style="max-width:300px">
        <div class="brand"><span class="mark" style="width:30px;height:30px;font-size:.85rem">${BRAND.initials}</span> ${BRAND.name}</div>
        <p class="muted" style="color:#bcae9b">Independently owned cabins in ${BRAND.town}. Book with us direct — no middleman, no platform fees, and you're talking straight to ${BRAND.host}.</p>
      </div>
      <div><div class="brand" style="font-size:1rem">Explore</div>
        <p><a href="index.html#stays">All cabins</a><br><a href="activities.html">Things to do</a><br><a href="index.html#about">Our story</a></p></div>
      <div><div class="brand" style="font-size:1rem">Reach us</div>
        <p>${BRAND.email}<br>${BRAND.phone}<br>${BRAND.town}</p></div>
    </div>
    <div class="powered">
      <span>© 2026 ${BRAND.name}. Book direct &amp; keep it local.</span>
      <span>Site built &amp; run by <b>Keepprz</b> — direct booking for independent hosts.</span>
    </div>
  </div></footer>`;
  const fslot = document.getElementById("chrome-foot");
  if(fslot) fslot.innerHTML = footer;
}

/* ---- image safety net: if any background photo fails to load,
       swap to a warm gradient so a guest never sees a broken image ---- */
const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg,#c8623c,#e0a03c)",
  "linear-gradient(135deg,#5a6b52,#8a9a7e)",
  "linear-gradient(135deg,#a84f2e,#c8623c)",
  "linear-gradient(135deg,#6c6157,#9a8b7a)",
  "linear-gradient(135deg,#5a6b52,#3a4633)",
];
function applyImageFallbacks(){
  document.querySelectorAll('[style*="background-image"]').forEach((el,i)=>{
    if(el.dataset.bgChecked) return; el.dataset.bgChecked="1";
    const m = (el.getAttribute('style')||"").match(/background-image\s*:\s*url\((['"]?)(.*?)\1\)/i);
    if(!m) return;
    const url = m[2];
    const probe = new Image();
    probe.onerror = () => { el.style.backgroundImage = FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length]; };
    probe.src = url;
  });
}
window.addEventListener('load', applyImageFallbacks);
