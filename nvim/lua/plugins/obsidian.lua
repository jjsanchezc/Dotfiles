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
  },
}
