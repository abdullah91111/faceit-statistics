const faceitPageContext = {
  url: window.location.href,
  title: document.title,
  detectedIds: [...new Set(window.location.href.match(/[a-f0-9-]{24,}/gi) ?? [])],
};

window.dispatchEvent(new CustomEvent("faceit-analyzer-context", { detail: faceitPageContext }));
