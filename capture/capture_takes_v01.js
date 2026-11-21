/* capture_takes_v01 · 2026-11-03 · amended 2026-11-20: reads shot list v02 (the Leue Studios editing course) · The takes on this phone, shared by the list and the recorder.
   Every piece of a take goes to IndexedDB as it records, so a crash keeps what was shot.
   A take with good=true turns its shot green. saved=true means it was sent; confirmed=true means Jason saw it arrive,
   and only then can it be freed. Freeing space drops a take's pieces (cleared=true) but keeps its record, so the shot
   stays green. */
"use strict";
const CaptureTakes = (() => {
  let dbPromise = null;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open("capture-takes", 1);
      req.onupgradeneeded = () => {
        const takes = req.result.createObjectStore("takes", { keyPath: "id" });
        takes.createIndex("script", "script");
        req.result.createObjectStore("chunks", { keyPath: ["take", "seq"] });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  function tx(stores, mode, fn) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      let out;
      Promise.resolve(fn(t)).then((v) => { out = v; });
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }
  const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const chunkRange = (id) => IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
  return {
    put: (take) => tx(["takes"], "readwrite", (t) => reqP(t.objectStore("takes").put(take))),
    putChunk: (take, seq, blob) => tx(["chunks"], "readwrite", (t) => reqP(t.objectStore("chunks").put({ take, seq, blob }))),
    forScript: (script) => tx(["takes"], "readonly", (t) => reqP(t.objectStore("takes").index("script").getAll(script))),
    all: () => tx(["takes"], "readonly", (t) => reqP(t.objectStore("takes").getAll())),
    async blob(take) {
      const rows = await tx(["chunks"], "readonly", (t) => reqP(t.objectStore("chunks").getAll(chunkRange(take.id))));
      rows.sort((a, b) => a.seq - b.seq);
      return new Blob(rows.map((r) => r.blob), { type: take.mime.split(";")[0] });
    },
    clearPieces: (id) => tx(["chunks"], "readwrite", (t) => { t.objectStore("chunks").delete(chunkRange(id)); }),
    /* the shot list is one file, so the list and the recorder read the same words */
    async shotList() {
      const r = await fetch("/capture/capture_shotlist_v03.json", { cache: "no-cache" });
      if (!r.ok) throw new Error("The shot list did not load (" + r.status + "). Check the connection and reload.");
      const list = await r.json();
      list.shots = list.sections.flatMap((s) => s.shots.map((shot) => ({ ...shot, section: s.name, setup: s.setup, project: s.project })));
      return list;
    },
    fileName(shot, take) {
      const slug = shot.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      return `${shot.project}_${shot.code}-${slug}_take${String(take.n).padStart(2, "0")}.${take.mime.includes("webm") ? "webm" : "mp4"}`;
    },
  };
})();
