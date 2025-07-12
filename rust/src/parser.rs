use crate::model::{self, Format};
use crate::{elf, mach, pe};
use goblin::Object;
use infer;

/// Perform a very fast type identification using `infer` magic-number matchers only.
/// This works on the first few kB of the buffer and does not require the
/// entire binary.
pub fn quick_identify(data: &[u8]) -> Result<model::FileKind, String> {
    match infer::get(data) {
        Some(kind) => {
            let mime = kind.mime_type();
            let fk = match mime {
                // ELF
                "application/x-executable" => model::FileKind::Known(Format::Elf),
                // PE (DLL/EXE share the same MIME string in `infer`)
                "application/vnd.microsoft.portable-executable" => {
                    model::FileKind::Known(Format::Pe)
                }
                // Mach-O
                "application/x-mach-binary" => model::FileKind::Known(Format::Mach),
                // Anything else still recognised by `infer`
                other => model::FileKind::Other(other.to_string()),
            };
            Ok(fk)
        }
        // `infer` could not recognise the buffer at all
        None => Ok(model::FileKind::Unknown),
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
