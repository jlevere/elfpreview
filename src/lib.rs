wit_bindgen::generate!({
    path: "./wit/",
    world: "elfpreview",
    pub_export_macro: true,
});

use crate::exports::elfpreview::parser::elfparser::Guest;
use goblin::elf::Elf;

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
}

export!(ElfParserImpl);
