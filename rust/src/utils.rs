use crate::bindings::bininspect::api::types::{BasicInfo, Bitness, Endianness, Format};
use goblin::{
    elf::{self, Elf},
    pe::PE,
};

fn format_enum(s: &str) -> Format {
    match s {
        "ELF" => Format::Elf,
        "PE" => Format::Pe,
        "Mach-O" => Format::Mach,
        _ => Format::Unknown,
    }
}

fn bitness_enum(is_64: bool) -> Bitness {
    if is_64 {
        Bitness::Bits64
    } else {
        Bitness::Bits32
    }
}

fn endianness_enum(endian: scroll::Endian) -> Endianness {
    match endian {
        scroll::Endian::Little => Endianness::Little,
        scroll::Endian::Big => Endianness::Big,
    }
}

pub fn build_basic_info(format: &str, elf: &Elf) -> Result<BasicInfo, String> {
    let is_stripped = !elf.section_headers.iter().any(|shdr| {
        if let Some(name) = elf.shdr_strtab.get_at(shdr.sh_name) {
            name.starts_with(".debug") || name == ".symtab"
        } else {
            false
        }
    });

    let basic = BasicInfo {
        format: format_enum(format),
        arch: get_arch_from_machine(&elf.header.e_machine.to_string()),
        bitness: bitness_enum(elf.is_64),
        endianness: match elf.header.endianness() {
            Ok(e) => endianness_enum(e),
            _ => Endianness::Little,
        },
        file_type: elf::header::et_to_str(elf.header.e_type).to_string(),
        entry_point: Some(elf.header.e_entry),
        stripped: is_stripped,
    };

    Ok(basic)
}

pub fn build_basic_info_pe(format: &str, pe: &PE) -> Result<BasicInfo, String> {
    let basic = BasicInfo {
        format: format_enum(format),
        arch: get_arch_from_pe_machine(pe.header.coff_header.machine),
        bitness: bitness_enum(pe.is_64),
        endianness: Endianness::Little,
        file_type: if pe.is_lib {
            "DLL".into()
        } else {
            "Executable".into()
        },
        entry_point: Some(pe.entry as u64),
        stripped: pe.header.coff_header.characteristics & 0x0200 != 0,
    };

    Ok(basic)
}

pub fn build_generic_basic_info(format: &str) -> BasicInfo {
    BasicInfo {
        format: format_enum(format),
        arch: "Unknown".into(),
        bitness: Bitness::Bits64,
        endianness: Endianness::Little,
        file_type: "Unknown".into(),
        entry_point: None,
        stripped: false,
    }
}

fn get_arch_from_machine(machine: &str) -> String {
    match machine {
        "x86" | "AMD x86-64" => "x86".to_string(),
        "ARM" | "ARM 64-bit" => "ARM".to_string(),
        "MIPS" | "MIPS RS3000" => "MIPS".to_string(),
        "PowerPC" | "PowerPC 64-bit" => "PowerPC".to_string(),
        "RISC-V" => "RISC-V".to_string(),
        _ => machine.to_string(),
    }
}

fn get_arch_from_pe_machine(machine: u16) -> String {
    match machine {
        0x014c => "x86".to_string(),
        0x0200 | 0x8664 => "x86".to_string(),
        0x01c0 | 0x01c2 | 0x01c4 => "ARM".to_string(),
        0xaa64 => "ARM".to_string(),
        _ => format!("Unknown (0x{:04x})", machine),
    }
}
