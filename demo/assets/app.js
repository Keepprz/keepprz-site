/* ============================================================
   Borah Vista — demo engine (powered by Keepprz)
   No backend. Availability + pricing all run client-side.
   ============================================================ */

const BRAND = {
  name: "Borah Vista",
  initials: "BV",
  host: "Jason",
  town: "Mackay, Idaho",
  email: "stay@borahvista.com",
  phone: "(208) 555-0188",
  taxRate: 0.08,            // ID lodging + local, illustrative
};

const U = (id, w=1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const LOCAL = f => `assets/img/${f}`;

/* ---- the one property (what Keepprz would store for this tenant) ---- */
const CABIN = {
  id:"borah", name:"The Borah Vista Cabin",
  tagline:"A log cabin at the foot of Idaho's tallest peak",
  location:"Mackay, Idaho · Lost River Valley", type:"Log cabin",
  guests:2, beds:1, baths:1, nightly:185, cleaning:95, rating:4.98, reviews:64,
  blurb:"A hand-built log cabin on open pasture, with the Lost River Range filling every window and nothing but sky after dark.",
  longDesc:"This is the kind of quiet you drive a long way for. The cabin sits alone on fenced pasture with the Lost River Range — Borah Peak included — stacked up behind it. Inside: a queen bed piled with warm layers, a wood-burning stove for cold nights, and a window framing the mountains from your pillow. Outside: a covered porch with a picnic table, a fire pit, and a BBQ grill. No neighbors, no light pollution — the stargazing is the best in the lower 48.",
  amenities:["Wood-burning stove","Queen bed","Covered front porch","Fire pit & BBQ grill","Lost River Range views","Wi-Fi","Coffee & kitchenette","Free parking","Dark-sky stargazing","Dogs welcome"],
  images:[LOCAL("bv-ext-25.jpg"), LOCAL("bv-int-25.jpg"), LOCAL("bv-ext-45.jpg"), LOCAL("bv-int-05.jpg"), LOCAL("bv-int-45.jpg")],
  booked:[["2026-06-19","2026-06-22"],["2026-07-03","2026-07-06"]],
};
const LISTINGS = [CABIN];
const getListing = () => CABIN;

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
function saveBooking(obj){ sessionStorage.setItem("bv_booking", JSON.stringify(obj)); }
function loadBooking(){ try{ return JSON.parse(sessionStorage.getItem("bv_booking")); }catch(e){ return null; } }
function genCode(){ return "BV-" + Math.random().toString(36).slice(2,7).toUpperCase(); }

/* ----------------------- page chrome ----------------------- */
function mountChrome(active){
  const ribbon = `<div class="demo-ribbon">⌁ <b>Live demo</b> — this is an example direct-booking site built &amp; run by <b>Keepprz</b>. Book away, no card is charged. <a href="dashboard.html">See the owner's view →</a></div>`;
  const header = `
  <header class="site-header"><div class="wrap">
    <a class="brand" href="index.html"><span class="mark">${BRAND.initials}</span> ${BRAND.name}</a>
    <nav class="nav">
      <a class="navlink ${active==='stays'?'on':''}" href="index.html#cabin">The cabin</a>
      <a class="navlink ${active==='activities'?'on':''}" href="activities.html">Things to do</a>
      <a class="navlink" href="index.html#about">Our story</a>
      <a class="btn btn-primary" href="index.html#book">Book direct</a>
    </nav>
  </div></header>`;
  const slot = document.getElementById("chrome-top");
  if(slot) slot.innerHTML = ribbon + header;

  const footer = `
  <footer class="site-footer"><div class="wrap">
    <div class="cols">
      <div style="max-width:300px">
        <div class="brand"><span class="mark" style="width:30px;height:30px;font-size:.85rem">${BRAND.initials}</span> ${BRAND.name}</div>
        <p class="muted" style="color:#bcae9b">An independently owned log cabin in ${BRAND.town}. Book direct — no middleman, no platform fees, and you're talking straight to ${BRAND.host}.</p>
      </div>
      <div><div class="brand" style="font-size:1rem">Explore</div>
        <p><a href="index.html#cabin">The cabin</a><br><a href="activities.html">Things to do</a><br><a href="index.html#about">Our story</a></p></div>
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
