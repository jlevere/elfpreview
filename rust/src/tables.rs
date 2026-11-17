use crate::elfpreview::parser::types;
use goblin::{
    elf::{Elf, program_header, section_header, sym::Symtab},
    strtab::Strtab,
};

pub(crate) fn build_dynlink_info(elf: &Elf<'_>) -> types::Dynlinkinfo {
    let is_dynamic = elf.dynamic.is_some() || elf.interpreter.is_some();

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

    types::Dynlinkinfo {
        is_dynamic,
        interpreter,
        needed_libs,
        soname,
        rpath,
        runpath,
    }
}

pub(crate) fn build_section_info(elf: &Elf<'_>) -> Vec<types::Sectioninfo> {
    elf.section_headers
        .iter()
        .enumerate()
        .map(|(index, header)| {
            let name = elf
                .shdr_strtab
                .get_at(header.sh_name)
                .unwrap_or("")
                .to_string();
            let typename = section_header::sht_to_str(header.sh_type).to_string();

            types::Sectioninfo {
                index: index as u32,
                offset: header.sh_offset,
                flags: header.sh_flags,
                alignment: header.sh_addralign,
                entry_size: header.sh_entsize,
                name,
                size: header.sh_size,
                address: header.sh_addr,
                typename,
            }
        })
        .collect()
}

pub(crate) fn build_program_info(elf: &Elf<'_>) -> Vec<types::Programinfo> {
    elf.program_headers
        .iter()
        .map(|header| {
            let typename = program_header::pt_to_str(header.p_type).to_string();

            let flagstring = format!(
                "{}{}{}",
                if header.p_flags & program_header::PF_R != 0 {
                    "R"
                } else {
                    ""
                },
                if header.p_flags & program_header::PF_W != 0 {
                    "W"
                } else {
                    ""
                },
                if header.p_flags & program_header::PF_X != 0 {
                    "X"
                } else {
                    ""
                },
            );

            types::Programinfo {
                offset: header.p_offset,
                alignment: header.p_align,
                typename,
                flagstring,
                vaddr: header.p_vaddr,
                paddr: header.p_paddr,
                filesz: header.p_filesz,
                memsz: header.p_memsz,
            }
        })
        .collect()
}

pub(crate) fn build_sym_info(
    symbols: &Symtab<'_>,
    strings: &Strtab<'_>,
    budget: &mut crate::limits::Budget,
) -> Vec<types::Symbolinfo> {
    symbols
        .iter()
        .enumerate()
        .map(|(index, sym)| {
            let name = strings.get_at(sym.st_name).unwrap_or("").to_string();
            types::Symbolinfo {
                index: index as u32,
                section_index: sym.st_shndx as u32,
                demangled_name: crate::demangle::name(&name, budget),
                name,
                typestr: goblin::elf::sym::type_to_str(sym.st_type()).to_string(),
                bind: goblin::elf::sym::bind_to_str(sym.st_bind()).to_string(),
                vis: goblin::elf::sym::visibility_to_str(sym.st_visibility()).to_string(),
                value: sym.st_value,
                size: sym.st_size,
            }
        })
        .collect()
}
