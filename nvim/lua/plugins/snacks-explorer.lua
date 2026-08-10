-- Override LazyVim's default explorer keymaps: swap <leader>e / <leader>E
-- Default: <leader>e = root dir, <leader>E = cwd
-- Here:    <leader>e = cwd,      <leader>E = root dir
return {
  "folke/snacks.nvim",
  keys = {
    {
      "<leader>e",
      function()
        Snacks.explorer()
      end,
      desc = "Explorer Snacks (cwd)",
    },
    {
      "<leader>E",
      function()
        Snacks.explorer({ cwd = LazyVim.root() })
      end,
      desc = "Explorer Snacks (root dir)",
    },
  },
}
