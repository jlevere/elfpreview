{
  description = "Development environment for VSCode extension dev with TS and Rust Wasip2";

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
          stable.toolchain
          targets.wasm32-wasip2.stable.rust-std
        ];
    in {
      devShells = {
        default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            nodePackages.pnpm

            nodePackages.typescript-language-server
            vscode-langservers-extracted

            wasm-tools

            llvmPackages.bintools
            go-task

            rust
          ];
        };
      };
    });
}
