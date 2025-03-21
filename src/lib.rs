wit_bindgen::generate!({
    path: "./wit/",
    world: "elfpreview",
    pub_export_macro: true,
});

use crate::exports::elfpreview::parser::elfparser::Guest;
use goblin::elf::{header, Elf};
use scroll::Pread;

struct ElfParserImpl;

impl Guest for ElfParserImpl {
    fn parseelf(data: Vec<u8>) -> Result<elfpreview::parser::types::Elfinfo, String> {
        match Elf::parse(&data) {
            Ok(elf) => {
                let sections = elf
                    .section_headers
                    .iter()
                    .enumerate()
                    .map(|(_i, header)| {
                        let name = elf
                            .shdr_strtab
                            .get_at(header.sh_name)
                            .unwrap_or("")
                            .to_string();
                        let typename = match header.sh_type {
                            0 => "NULL".to_string(),
                            1 => "PROGBITS".to_string(),
                            2 => "SYMTAB".to_string(),
                            3 => "STRTAB".to_string(),
                            4 => "RELA".to_string(),
                            5 => "HASH".to_string(),
                            6 => "DYNAMIC".to_string(),
                            7 => "NOTE".to_string(),
                            8 => "NOBITS".to_string(),
                            9 => "REL".to_string(),
                            10 => "SHLIB".to_string(),
                            11 => "DYNSYM".to_string(),
                            _ => format!("0x{:x}", header.sh_type),
                        };

                        elfpreview::parser::types::Sectioninfo {
                            name,
                            size: header.sh_size,
                            address: header.sh_addr,
                            typename,
                        }
                    })
                    .collect();

                let programs = elf
                    .program_headers
                    .iter()
                    .map(|header| {
                        let typename = match header.p_type {
                            0 => "NULL".to_string(),
                            1 => "LOAD".to_string(),
                            2 => "DYNAMIC".to_string(),
                            3 => "INTERP".to_string(),
                            4 => "NOTE".to_string(),
                            5 => "SHLIB".to_string(),
                            6 => "PHDR".to_string(),
                            7 => "TLS".to_string(),
                            _ => format!("0x{:x}", header.p_type),
                        };

                        let flagstring = format!(
                            "{}{}{}",
                            if header.p_flags & 4 != 0 { "R" } else { "" },
                            if header.p_flags & 2 != 0 { "W" } else { "" },
                            if header.p_flags & 1 != 0 { "X" } else { "" },
                        );

                        elfpreview::parser::types::Programinfo {
                            typename,
                            flagstring,
                            vaddr: header.p_vaddr,
                            paddr: header.p_paddr,
                            filesz: header.p_filesz,
                            memsz: header.p_memsz,
                        }
                    })
                    .collect();

                let symbols = elf
                    .syms
                    .iter()
                    .map(|sym| {
                        let name = elf.strtab.get_at(sym.st_name).unwrap_or("").to_string();
                        elfpreview::parser::types::Symbolinfo {
                            name,
                            value: sym.st_value,
                            size: sym.st_size,
                            isfunction: sym.is_function(),
                        }
                    })
                    .collect();

                let info = elfpreview::parser::types::Elfinfo {
                    machine: elf.header.e_machine.to_string(),
                    entrypoint: elf.header.e_entry,
                    sectionheaders: sections,
                    programheaders: programs,
                    symbols,
                };

                Ok(info)
            }
            Err(e) => Err(format!("{:?}", e)),
        }
    }

    fn validateelf(data: Vec<u8>) -> Result<elfpreview::parser::types::Headerinfo, String> {
        // Basic size check
        if data.len() < std::mem::size_of::<header::header64::Header>() {
            return Err("File too small to be an ELF".to_string());
        }

        // Check magic number
        if data[0] != 0x7F || data[1] != 0x45 || data[2] != 0x4C || data[3] != 0x46 {
            return Err("Invalid ELF magic number".to_string());
        }

        // Parse just the header directly
        match data.pread::<header::Header>(0) {
            Ok(header) => {
                // Get class (32/64 bit)
                let class = match header.e_ident[header::EI_CLASS] {
                    header::ELFCLASS32 => "32-bit".to_string(),
                    header::ELFCLASS64 => "64-bit".to_string(),
                    _ => "unknown".to_string(),
                };

                // Get endianness
                let endianness = match header.e_ident[header::EI_DATA] {
                    header::ELFDATA2LSB => "little-endian".to_string(),
                    header::ELFDATA2MSB => "big-endian".to_string(),
                    _ => "unknown".to_string(),
                };

                // Get OS ABI
                let osabi = match header.e_ident[header::EI_OSABI] {
                    header::ELFOSABI_SYSV => "UNIX System V".to_string(),
                    header::ELFOSABI_LINUX => "Linux".to_string(),
                    header::ELFOSABI_FREEBSD => "FreeBSD".to_string(),
                    header::ELFOSABI_NETBSD => "NetBSD".to_string(),
                    header::ELFOSABI_SOLARIS => "Solaris".to_string(),
                    _ => format!("Unknown ({})", header.e_ident[header::EI_OSABI]),
                };

                // Get file type
                let filetype = match header.e_type {
                    header::ET_NONE => "NONE".to_string(),
                    header::ET_REL => "REL".to_string(),
                    header::ET_EXEC => "EXEC".to_string(),
                    header::ET_DYN => "DYN".to_string(),
                    header::ET_CORE => "CORE".to_string(),
                    _ => format!("Unknown ({})", header.e_type),
                };

                // Calculate headers size from header info
                let headers_size = header.e_phoff
                    + (header.e_phentsize as u64 * header.e_phnum as u64)
                    + (header.e_shentsize as u64 * header.e_shnum as u64);

                let header_info = elfpreview::parser::types::Headerinfo {
                    isvalid: true,
                    class,
                    endianness,
                    osabi,
                    filetype,
                    machine: header::machine_to_str(header.e_machine).to_string(),
                    version: header.e_version,
                    headerssize: headers_size,
                };

                Ok(header_info)
            }
            Err(e) => Err(format!("Invalid ELF header: {:?}", e)),
        }
    }
}

export!(ElfParserImpl);
