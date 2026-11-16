wit_bindgen::generate!({ path: "../wit/", world: "elfpreview" });

mod metadata;
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
    let stripped = !elf
        .section_headers
        .iter()
        .any(|section| section.sh_type == SHT_SYMTAB);
    Ok(types::Elfinfo {
        info: metadata::file_info(&elf.header, Some(stripped))?,
        sectionheaders: tables::build_section_info(&elf),
        programheaders: tables::build_program_info(&elf),
        symbols: tables::build_sym_info(&elf),
        dynlink: tables::build_dynlink_info(&elf),
    })
}

impl Guest for ElfParser {
    fn parseelf(data: Vec<u8>) -> Result<types::Elfinfo, String> {
        parse(&data).map_err(|error| error.to_string())
    }

    fn validateelf(data: Vec<u8>) -> Result<bool, String> {
        metadata::parse_header(&data)
            .map(|_| true)
            .map_err(|error| error.to_string())
    }

    fn quickparseelf(data: Vec<u8>) -> Result<types::Fileinfo, String> {
        metadata::parse_header(&data)
            .and_then(|header| metadata::file_info(&header, None))
            .map_err(|error| error.to_string())
    }
}

export!(ElfParser);
