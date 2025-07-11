use crate::bindings::bininspect::api::types::{Bitness, Endianness};
use crate::{model, utils};
use goblin::mach::Mach;

pub fn file_info(format: &str, mach: &Mach) -> model::BasicInfo {
    use goblin::mach::Mach::*;

    let mut info = utils::build_generic_basic_info(format);

    match mach {
        Binary(macho) => {
            let header = &macho.header;
            use goblin::mach::header::{MH_CIGAM_64, MH_MAGIC, MH_MAGIC_64};

            info.bitness = if matches!(header.magic, MH_MAGIC_64 | MH_CIGAM_64) {
                Bitness::Bits64
            } else {
                Bitness::Bits32
            };

            info.endianness = if matches!(header.magic, MH_MAGIC | MH_MAGIC_64) {
                Endianness::Little
            } else {
                Endianness::Big
            };

            info.arch = match header.cputype {
                goblin::mach::constants::cputype::CPU_TYPE_X86 => "x86".into(),
                goblin::mach::constants::cputype::CPU_TYPE_X86_64 => "x86-64".into(),
                goblin::mach::constants::cputype::CPU_TYPE_ARM => "ARM".into(),
                goblin::mach::constants::cputype::CPU_TYPE_ARM64 => "ARM64".into(),
                _ => format!("0x{:x}", header.cputype),
            };
            info.entry_point = Some(macho.entry);
            info.file_type = format!("0x{:x}", header.filetype);
        }
        Fat(fat) => {
            info.arch = format!("{} arch slice(s)", fat.narches);
        }
    }

    info
}

pub fn parse_mach_header(data: &[u8]) -> Result<model::BasicInfo, String> {
    match goblin::Object::parse(data) {
        Ok(goblin::Object::Mach(mach)) => Ok(file_info("Mach-O", &mach)),
        Ok(_) => Err("Not a Mach-O binary".into()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn parse_mach_details(data: &[u8]) -> Result<model::MachDetails, String> {
    match goblin::Object::parse(data) {
        Ok(goblin::Object::Mach(_mach)) => {
            let details = model::MachDetails {
                segments: Vec::new(),
                dylibs: Vec::new(),
            };
            Ok(details)
        }
        Ok(_) => Err("Not a Mach-O binary".into()),
        Err(e) => Err(e.to_string()),
    }
}
