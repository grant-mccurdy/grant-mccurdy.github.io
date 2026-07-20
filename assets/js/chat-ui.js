(function attachPortfolioChatUI(global) {
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const renderInlineMarkdown = (value) =>
    escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  const safeHttpUrl = (value, baseUrl = global.location?.href || "https://grant-mccurdy.github.io/") => {
    try {
      const url = new URL(String(value || ""), baseUrl);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

  global.PortfolioChatUI = Object.freeze({ escapeHtml, renderInlineMarkdown, safeHttpUrl });
})(window);
