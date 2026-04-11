module.exports = function(eleventyConfig) {

  // Passthrough copy
  eleventyConfig.addPassthroughCopy("src/assets/css");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy("src/robots.txt.njk");

  // Custom collection: brands
  eleventyConfig.addCollection("brands", function(collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/brands/*.md")
      .filter(item => item.data.status === "published")
      .sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
  });

  // Filters
  eleventyConfig.addFilter("dateFormat", function(date, format) {
    const d = new Date(date);
    const options = {};
    if (format === "iso") return d.toISOString();
    if (format === "year") return d.getFullYear().toString();
    options.year = "numeric";
    options.month = "long";
    options.day = "numeric";
    return d.toLocaleDateString("en-AU", options);
  });

  eleventyConfig.addFilter("excerpt", function(content) {
    if (!content) return "";
    const text = content.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    return text.length > 160 ? text.substring(0, 160) + "..." : text;
  });

  // Shortcodes
  eleventyConfig.addShortcode("year", function() {
    return new Date().getFullYear().toString();
  });

  // Data deep merge
  eleventyConfig.setDataDeepMerge(true);

  return {
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    }
  };
};
