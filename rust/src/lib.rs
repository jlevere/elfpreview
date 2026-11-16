wit_bindgen::generate!({ path: "../wit/", world: "elfpreview" });

mod limits;
mod metadata;
mod relocations;
mod tables;
#[cfg(test)]
mod tests;

use elfpreview::parser::types;
use exports::elfpreview::parser::elfparser::Guest;
use goblin::elf::{Elf, section_header::SHT_SYMTAB};

struct ElfParser;

fn parse(data: &[u8]) -> goblin::error::Result<types::Elfinfo> {
    metadata::parse_header(data)?;
    let elf = Elf::parse(data)?;
    let mut budget = limits::check_report(&elf)?;
    let relocations = relocations::build(data, &elf, &mut budget)?;
    let stripped = !elf
        .section_headers
        .iter()
        .any(|section| section.sh_type == SHT_SYMTAB);
    Ok(types::Elfinfo {
        info: metadata::file_info(&elf.header, stripped)?,
        sectionheaders: tables::build_section_info(&elf),
        programheaders: tables::build_program_info(&elf),
        symbols: tables::build_sym_info(&elf.syms, &elf.strtab),
        dynamic_symbols: tables::build_sym_info(&elf.dynsyms, &elf.dynstrtab),
        relocations,
        dynlink: tables::build_dynlink_info(&elf),
    })
}

impl Guest for ElfParser {
    fn parseelf(data: Vec<u8>) -> Result<types::Elfinfo, String> {
        parse(&data).map_err(|error| error.to_string())
    }
}

export!(ElfParser);
