{lib}: {
  authoritative = import ./authoritative.nix {inherit lib;};
  apiKeys = import ./api-keys.nix {inherit lib;};
  brandingOptions = import ./branding-options.nix {inherit lib;};
  encodingOptions = import ./encoding-options.nix {inherit lib;};
  library = import ./library.nix {inherit lib;};
  livetv = import ./livetv.nix {inherit lib;};
  networking = import ./networking.nix {inherit lib;};
  metadata = import ./metadata.nix {inherit lib;};
  plugins = import ./plugins.nix {inherit lib;};
  scheduledTasks = import ./scheduled-tasks.nix {inherit lib;};
  root = import ./root.nix {inherit lib;};
  startup = import ./startup.nix {inherit lib;};
  system = import ./system.nix {inherit lib;};
  users = import ./users.nix {inherit lib;};
}
