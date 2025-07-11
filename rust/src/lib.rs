mod bindings {
    wit_bindgen::generate!({
        path: "../wit/",
        world: "bininspect",
    });
}

// Re-export the generated modules for convenience
pub use bindings::bininspect;

mod mach;
mod model;
mod parser;

// The generated Guest trait lives under `exports::<world>::api::inspector::Guest`
use bindings::exports::bininspect::api::inspector::Guest;

mod elf;
mod pe;
mod utils;

pub struct BinaryParser;

impl Guest for BinaryParser {
    fn identify(data: Vec<u8>) -> Result<crate::model::BasicInfo, String> {
        parser::quick_identify(&data)
    }

    fn parse(data: Vec<u8>) -> Result<crate::model::Details, String> {
        parser::parse(&data)
    }
}

bindings::export!(BinaryParser with_types_in bindings);

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bindings::bininspect::api::types::Format;
    use std::fs;
    use std::path::Path;

    fn load_test_file(filename: &str) -> Vec<u8> {
        let test_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
        let filepath = test_dir.join(filename);
        fs::read(filepath).expect("Failed to read test file")
    }

    #[test]
    fn test_quick_info() {
        let elf_data = load_test_file("simple_test");
        let result = BinaryParser::identify(elf_data);
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.format, Format::Elf);
    }
}
