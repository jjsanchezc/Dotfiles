return {
  {
    "neanias/everforest-nvim",
    priority = 1000,
    config = function()
      require("everforest").setup({
        background = "hard", -- soft, medium, hard
        transparent_background_level = 0,
      })

      vim.cmd.colorscheme("everforest")
    end,
  },

  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "everforest",
    },
  },
}
