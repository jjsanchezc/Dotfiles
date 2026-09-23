-- obsidian.nvim's builtin wiki_link uses a GitHub-style slug for the heading
-- anchor (e.g. "#password-is-not-disabled"), but Obsidian itself resolves
-- [[note#Heading]] links against the literal heading text, not a slug. This
-- mirrors builtin.wiki_link but anchors on `header` instead of `anchor`.
local function literal_wiki_link(opts)
  local anchor, header = "", ""
  if opts.anchor then
    if type(opts.anchor) == "table" then
      anchor = "#" .. opts.anchor.header
      header = string.format(" ❯ %s", opts.anchor.header)
    else
      anchor = opts.anchor
    end
  elseif opts.block then
    if type(opts.block) == "table" then
      anchor = "#" .. opts.block.id
      header = "#" .. opts.block.id
    else
      anchor = opts.block
    end
  end

  local path = tostring(opts.path or "")
  local label = tostring(opts.label or "")
  local stem = path:gsub("%.md$", "")

  if label ~= "" and label ~= stem then
    return string.format("[[%s%s|%s%s]]", stem, anchor, label, header)
  end
  return string.format("[[%s%s]]", stem, anchor)
end

return {
  "obsidian-nvim/obsidian.nvim",
  version = "*",

  ft = "markdown",

  opts = {
    legacy_commands = false,
    workspaces = {
      {
        name = "master",
        path = "~/Documents/obsidian/Master",
      },
      {
        name = "cs",
        path = "~/Documents/obsidian/cs/",
      }
    },
    link = {
      style = literal_wiki_link,
    },
  },
}
