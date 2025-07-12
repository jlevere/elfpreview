use crate::model;
use crate::{elf, mach, pe};
use goblin::Object;

/// Perform a very fast type identification based on container headers or
/// generic magic-byte signatures.
pub fn quick_identify(data: &[u8]) -> Result<model::FileKind, String> {
    // Fast path via `goblin` for the formats we actually support deeply.
    if let Ok(obj) = Object::parse(data) {
        return match obj {
            Object::Elf(_) => Ok(model::FileKind::Elf),
            Object::PE(_) => Ok(model::FileKind::Pe),
            Object::Mach(_) => Ok(model::FileKind::Mach),
            _ => identify_with_infer(data),
        };
    }

    // If goblin itself failed to parse, still try to guess using `infer`.
    identify_with_infer(data)
}

fn identify_with_infer(data: &[u8]) -> Result<model::FileKind, String> {
    match infer::get(data) {
        Some(kind) => Ok(model::FileKind::Other(kind.mime_type().to_string())),
        None => Ok(model::FileKind::Other("unknown".into())),
    }
}

pub fn parse(data: &[u8]) -> Result<model::Details, String> {
    match Object::parse(data) {
        Ok(obj) => match obj {
            Object::Elf(_) => elf::parse_elf(data).map(model::Details::Elf),
            Object::PE(_) => pe::parse_pe(data).map(model::Details::Pe),
            Object::Mach(_) => mach::parse_mach_details(data).map(model::Details::Mach),
            _ => Ok(model::Details::Unsupported),
        },
        Err(e) => Err(format!("Failed to parse binary: {e}")),
    }
}
