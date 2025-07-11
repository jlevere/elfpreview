use crate::model;
use crate::{elf, mach, pe};
use goblin::Object;

pub fn quick_identify(data: &[u8]) -> Result<model::BasicInfo, String> {
    match Object::parse(data) {
        Ok(obj) => match obj {
            Object::Elf(_) => elf::parse_elf_header(data),
            Object::PE(_) => pe::parse_pe_header(data),
            Object::Mach(_) => mach::parse_mach_header(data),
            Object::Archive(_) => Ok(crate::utils::build_generic_basic_info("Archive")),
            Object::Unknown(magic) => Err(format!("Unknown binary format: {magic:x?}")),
            _ => Ok(crate::utils::build_generic_basic_info("Unknown")),
        },
        Err(e) => Err(format!("Failed to parse binary: {e}")),
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
