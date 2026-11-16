use crate::{elfpreview::parser::types::Relocationinfo, limits::Budget};
use goblin::{
    container::{Container, Ctx},
    elf::{
        Elf,
        reloc::{self, Reloc, RelocSection},
        section_header::{SHT_DYNSYM, SHT_STRTAB, SHT_SYMTAB},
        sym::{Sym, Symtab},
    },
    error::{Error, Result},
    strtab::Strtab,
};
use std::collections::BTreeSet;

struct Source<'a> {
    name: &'a str,
    target: Option<&'a str>,
    file_offset: u64,
    entries: &'a RelocSection<'a>,
    symbols: &'a Symtab<'a>,
    strings: &'a Strtab<'a>,
}

struct Builder {
    seen: BTreeSet<u64>,
    rows: Vec<Relocationinfo>,
    ctx: Ctx,
    machine: u16,
}

impl Builder {
    fn append(&mut self, source: Source<'_>, budget: &mut Budget) -> Result<()> {
        for (index, entry) in source.entries.iter().enumerate() {
            let stride = Reloc::size(entry.r_addend.is_some(), self.ctx) as u64;
            let position = source
                .file_offset
                .checked_add(index as u64 * stride)
                .ok_or_else(|| Error::Malformed("Relocation table offset overflow".into()))?;
            // Section headers and dynamic tags can describe the same on-disk entries.
            if !self.seen.insert(position) {
                continue;
            }
            let symbol = if entry.r_sym == 0 {
                None
            } else {
                source
                    .symbols
                    .get(entry.r_sym)
                    .and_then(|symbol| source.strings.get_at(symbol.st_name))
            };
            budget.relocation(&[
                source.name,
                source.target.unwrap_or(""),
                symbol.unwrap_or(""),
            ])?;
            self.rows.push(Relocationinfo {
                table: source.name.into(),
                target_section: source.target.map(String::from),
                offset: entry.r_offset,
                type_id: entry.r_type,
                type_name: format!("R_{}", reloc::r_to_str(entry.r_type, self.machine)),
                symbol_index: entry.r_sym as u32,
                symbol_name: symbol.map(String::from),
                // REL stores its addend in the target bytes; do not invent a decoded value.
                addend: entry.r_addend,
            });
        }
        Ok(())
    }
}

fn file_index(value: u64) -> Result<usize> {
    usize::try_from(value)
        .map_err(|_| Error::Malformed("ELF table offset exceeds addressable input".into()))
}

pub(crate) fn build(
    data: &[u8],
    elf: &Elf<'_>,
    budget: &mut Budget,
) -> Result<Vec<Relocationinfo>> {
    let container = if elf.is_64 {
        Container::Big
    } else {
        Container::Little
    };
    let ctx = Ctx::new(container, elf.header.endianness()?);
    let mut builder = Builder {
        seen: BTreeSet::new(),
        rows: Vec::new(),
        ctx,
        machine: elf.header.e_machine,
    };
    for (index, entries) in &elf.shdr_relocs {
        if entries.is_empty() {
            continue;
        }
        let section = &elf.section_headers[*index];
        let mut symbols = Symtab::default();
        let mut strings = Strtab::default();
        if section.sh_link != 0 {
            let linked = elf
                .section_headers
                .get(section.sh_link as usize)
                .filter(|section| matches!(section.sh_type, SHT_SYMTAB | SHT_DYNSYM))
                .ok_or_else(|| {
                    Error::Malformed("Relocation sh_link does not reference a symbol table".into())
                })?;
            let stride = Sym::size(container) as u64;
            if linked.sh_entsize != stride || linked.sh_size % stride != 0 {
                return Err(Error::Malformed(
                    "Invalid relocation symbol table entry size".into(),
                ));
            }
            symbols = Symtab::parse(
                data,
                file_index(linked.sh_offset)?,
                file_index(linked.sh_size / stride)?,
                ctx,
            )?;
            let names = elf
                .section_headers
                .get(linked.sh_link as usize)
                .filter(|section| section.sh_type == SHT_STRTAB)
                .ok_or_else(|| {
                    Error::Malformed("Symbol sh_link does not reference a string table".into())
                })?;
            strings = Strtab::parse(
                data,
                file_index(names.sh_offset)?,
                file_index(names.sh_size)?,
                0,
            )?;
        }
        let target = if section.sh_info == 0 {
            None
        } else {
            elf.section_headers
                .get(section.sh_info as usize)
                .and_then(|target| elf.shdr_strtab.get_at(target.sh_name))
        };
        builder.append(
            Source {
                name: elf.shdr_strtab.get_at(section.sh_name).unwrap_or(""),
                target,
                file_offset: section.sh_offset,
                entries,
                symbols: &symbols,
                strings: &strings,
            },
            budget,
        )?;
    }
    if let Some(dynamic) = &elf.dynamic {
        // Dynamic tables also work when section headers have been removed.
        for (name, offset, entries) in [
            ("DT_RELA", dynamic.info.rela, &elf.dynrelas),
            ("DT_REL", dynamic.info.rel, &elf.dynrels),
            ("DT_JMPREL", dynamic.info.jmprel, &elf.pltrelocs),
        ] {
            builder.append(
                Source {
                    name,
                    target: None,
                    file_offset: offset as u64,
                    entries,
                    symbols: &elf.dynsyms,
                    strings: &elf.dynstrtab,
                },
                budget,
            )?;
        }
    }
    Ok(builder.rows)
}
