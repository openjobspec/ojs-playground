/**
 * OJS Playground — Embeddable Widget
 *
 * Usage:
 *   <script src="https://playground.openjobspec.org/embed.js"
 *           data-url="http://localhost:8080"
 *           data-theme="dark"
 *           data-width="100%"
 *           data-height="300"></script>
 */
(function () {
  "use strict";

  var EMBED_ORIGIN = "https://playground.openjobspec.org";

  // Find the current script tag to read data attributes
  var scripts = document.getElementsByTagName("script");
  var currentScript = scripts[scripts.length - 1];

  var apiUrl = currentScript.getAttribute("data-url") || "http://localhost:8080";
  var theme = currentScript.getAttribute("data-theme") || "light";
  var width = currentScript.getAttribute("data-width") || "100%";
  var height = currentScript.getAttribute("data-height") || "300";

  // Resolve embed.html relative to the script src, or use the default origin
  var scriptSrc = currentScript.getAttribute("src") || "";
  var baseUrl;
  if (scriptSrc && scriptSrc.indexOf("://") !== -1) {
    baseUrl = scriptSrc.substring(0, scriptSrc.lastIndexOf("/"));
  } else {
    baseUrl = EMBED_ORIGIN;
  }

  var embedSrc =
    baseUrl +
    "/embed.html?url=" +
    encodeURIComponent(apiUrl) +
    "&theme=" +
    encodeURIComponent(theme);

  // Normalize dimensions — append "px" to bare numbers
  function normalizeDim(value) {
    if (/^\d+$/.test(value)) return value + "px";
    return value;
  }

  // Create wrapper
  var wrapper = document.createElement("div");
  wrapper.style.cssText =
    "max-width:100%;overflow:hidden;border-radius:8px;border:1px solid " +
    (theme === "dark" ? "#30363d" : "#d0d7de") +
    ";";

  // Create iframe
  var iframe = document.createElement("iframe");
  iframe.src = embedSrc;
  iframe.style.cssText =
    "width:" +
    normalizeDim(width) +
    ";height:" +
    normalizeDim(height) +
    ";border:none;display:block;color-scheme:" +
    (theme === "dark" ? "dark" : "normal") +
    ";";
  iframe.setAttribute("title", "OJS Playground");
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-forms"
  );

  wrapper.appendChild(iframe);

  // Replace script tag with the widget
  currentScript.parentNode.insertBefore(wrapper, currentScript);

  // Listen for resize messages from the iframe
  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "ojs-playground-resize") return;
    // Only accept messages from our iframe
    if (event.source !== iframe.contentWindow) return;
    var newHeight = Math.max(200, Math.min(event.data.height || 300, 800));
    iframe.style.height = newHeight + "px";
  });
})();
