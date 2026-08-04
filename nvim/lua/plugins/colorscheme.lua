return {
  {
    "neanias/everforest-nvim",
    lazy = true,
    priority = 1000,
    config = function()
      require("everforest").setup({
        background = "hard", -- soft, medium, hard
        transparent_background_level = 0,
      })
    end,
  },

  {
    "ellisonleao/gruvbox.nvim",
    lazy = true,
    priority = 1000,
    opts = {
      contrast = "hard", -- "hard", "soft" or ""
    },
  },

  {
    "catppuccin/nvim",
    name = "catppuccin",
    lazy = true,
    priority = 1000,
    opts = {
      flavour = "mocha", -- latte, frappe, macchiato, mocha
    },
  },

  -- Quick switch: <leader>uC opens a live-preview picker over every
  -- installed colorscheme (from the LazyVim editor.snacks_picker extra).
  -- This never changes on its own — matugen/Hyprland theming is separate.
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "everforest",
    },
  },
}
