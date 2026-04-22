var m = Object.defineProperty;
var g = (s, o, e) => o in s ? m(s, o, { enumerable: !0, configurable: !0, writable: !0, value: e }) : s[o] = e;
var i = (s, o, e) => g(s, typeof o != "symbol" ? o + "" : o, e);
function f(s, o) {
  if (!s) return o;
  const e = /^(\d{1,4}(?:\.\d{1,2})?)(px|%|rem|em|vh|vw)?$/.exec(s.trim());
  if (!e) return o;
  const n = Number(e[1]), t = e[2] ?? "px", a = t === "px" ? 4e3 : t === "rem" || t === "em" ? 200 : 100;
  return !Number.isFinite(n) || n <= 0 || n > a ? o : `${n}${t}`;
}
const y = /* @__PURE__ */ new Set(["light", "dark", "system"]), d = /* @__PURE__ */ new Set(["go", "javascript", "python", "ruby", "rust", "java"]), h = 64 * 1024, w = 1024 * 1024, b = (() => {
  const s = new URL(
    /* @vite-ignore */
    ".",
    import.meta.url
  );
  return s.protocol === "http:" || s.protocol === "https:" ? s : typeof window < "u" ? new URL("/", window.location.href) : new URL("https://play.openjobspec.org/");
})();
class E extends HTMLElement {
  constructor() {
    super();
    i(this, "iframe", null);
    i(this, "shadow");
    i(this, "handleMessage", (e) => {
      var a;
      if (e.source !== ((a = this.iframe) == null ? void 0 : a.contentWindow) || !u(e.data)) return;
      const n = e.data.type, t = e.data.payload;
      u(t) && (n === "ojs-spec-change" && typeof t.spec == "string" && t.spec.length <= h ? this.dispatchEvent(new CustomEvent("ojs-spec-change", { detail: { spec: t.spec } })) : n === "ojs-code-copy" && typeof t.language == "string" && d.has(t.language) && typeof t.code == "string" && t.code.length <= w && this.dispatchEvent(new CustomEvent("ojs-code-copy", {
        detail: { language: t.language, code: t.code }
      })));
    });
    this.shadow = this.attachShadow({ mode: "open" });
  }
  static get observedAttributes() {
    return ["theme", "language", "spec", "height", "readonly"];
  }
  connectedCallback() {
    this.ensureDOM(), this.update(), window.addEventListener("message", this.handleMessage);
  }
  disconnectedCallback() {
    window.removeEventListener("message", this.handleMessage);
  }
  attributeChangedCallback() {
    this.isConnected && this.update();
  }
  ensureDOM() {
    if (this.iframe) return;
    const e = document.createElement("style");
    e.textContent = `
      :host {
        display: block;
        width: 100%;
        height: var(--ojs-playground-height, 500px);
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }
      iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
      }
    `;
    const n = document.createElement("iframe");
    n.title = "OJS Playground", n.loading = "lazy", n.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-forms"), this.shadow.append(e, n), this.iframe = n;
  }
  update() {
    if (!this.iframe) return;
    const e = this.getAttribute("theme"), n = this.getAttribute("language"), t = this.getAttribute("spec"), a = e && y.has(e) ? e : "system", l = n && d.has(n) ? n : "go", c = t && t.length <= h ? t : "", p = f(this.getAttribute("height"), "500px");
    this.style.setProperty("--ojs-playground-height", p);
    const r = new URL(b);
    r.searchParams.set("embed", "1"), r.searchParams.set("theme", a), r.searchParams.set("language", l), this.hasAttribute("readonly") && r.searchParams.set("readonly", "1"), c && r.searchParams.set("spec", encodeURIComponent(c)), this.iframe.src = r.toString();
  }
}
function u(s) {
  return s !== null && typeof s == "object" && !Array.isArray(s);
}
typeof customElements < "u" && !customElements.get("ojs-playground") && customElements.define("ojs-playground", E);
export {
  E as OJSPlayground
};
