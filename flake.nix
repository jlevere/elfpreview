{
  description = "Development environment for VSCode extension dev with TypeScript and Rust WebAssembly";

  inputs = {
    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    fenix,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = nixpkgs.legacyPackages.${system};
      rust = with fenix.packages.${system};
        combine [
          stable.rustc
          stable.cargo
          stable.clippy
          stable.rustfmt
          stable.rust-std
          targets.wasm32-unknown-unknown.stable.rust-std
        ];
    in {
      devShells = {
        default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_24
            pnpm

            typescript-language-server
            vscode-langservers-extracted

            wasm-tools

            llvmPackages.bintools

            rust
          ];
        };
      };
    });
}
