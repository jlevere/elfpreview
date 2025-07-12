use crate::bindings::bininspect::api::types as wit_types;
use goblin::elf::*;

pub fn parse_elf(data: &[u8]) -> Result<crate::model::ElfDetails, String> {
    match Elf::parse(data) {
        Ok(elf) => {
            let info = crate::model::ElfDetails {
                sections: build_section_info(&elf),
                program_headers: build_program_info(&elf),
                symbols: build_sym_info(&elf),
                dynlink: build_dynlink_info(&elf),
            };

            Ok(info)
        }
        Err(e) => Err(format!("{:?}", e)),
    }
}

fn build_section_info(elf: &Elf) -> Vec<wit_types::ElfSectionInfo> {
    elf.section_headers
        .iter()
        .map(|header| {
            let name = elf
                .shdr_strtab
                .get_at(header.sh_name)
                .unwrap_or("")
                .to_string();
            let kind = section_header::sht_to_str(header.sh_type).to_string();

            wit_types::ElfSectionInfo {
                name,
                size: header.sh_size,
                address: header.sh_addr,
                kind,
            }
        })
        .collect()
}

fn build_program_info(elf: &Elf) -> Vec<wit_types::ElfProgramHeader> {
    elf.program_headers
        .iter()
        .map(|header| {
            let kind = program_header::pt_to_str(header.p_type).to_string();

            let flag_string = format!(
                "{}{}{}",
                if header.p_flags & 4 != 0 { "R" } else { "" },
                if header.p_flags & 2 != 0 { "W" } else { "" },
                if header.p_flags & 1 != 0 { "X" } else { "" },
            );

            wit_types::ElfProgramHeader {
                kind,
                flag_string,
                vaddr: header.p_vaddr,
                paddr: header.p_paddr,
                file_size: header.p_filesz,
                mem_size: header.p_memsz,
            }
        })
        .collect()
}

fn build_sym_info(elf: &Elf) -> Vec<wit_types::ElfSymbolInfo> {
    elf.syms
        .iter()
        .map(|sym| {
            let name = elf.strtab.get_at(sym.st_name).unwrap_or("").to_string();
            wit_types::ElfSymbolInfo {
                name,
                kind: sym::type_to_str(sym.st_type()).to_string(),
                bind: sym::bind_to_str(sym.st_bind()).to_string(),
                vis: sym::visibility_to_str(sym.st_type()).to_string(),
                value: sym.st_value,
                size: sym.st_size,
            }
        })
        .collect()
}

fn build_dynlink_info(elf: &Elf) -> wit_types::ElfDynlinkInfo {
    let is_dynamic = elf.is_lib
        || elf.dynamic.is_some()
        || !elf.libraries.is_empty()
        || elf.interpreter.is_some()
        || !elf.rpaths.is_empty()
        || !elf.runpaths.is_empty();

    let interpreter = elf.interpreter.map(String::from);
    let needed_libs = elf.libraries.iter().map(|lib| lib.to_string()).collect();
    let soname = elf.soname.map(String::from);

    let rpath = if elf.rpaths.is_empty() {
        None
    } else {
        Some(elf.rpaths.iter().map(|s| s.to_string()).collect())
    };

    let runpath = if elf.runpaths.is_empty() {
        None
    } else {
        Some(elf.runpaths.iter().map(|s| s.to_string()).collect())
    };

    wit_types::ElfDynlinkInfo {
        is_dynamic,
        interpreter,
        needed_libs,
        soname,
        rpath,
        runpath,
    }
}
