use goblin::{
    elf::Elf,
    error::{Error, Result},
};

// Input size and Wasm memory limits do not bound the lifted JS object graph.
// Count repeated references before cloning strings for the canonical ABI.
const MAX_RECORDS: usize = 250_000;
const MAX_TEXT_BYTES: usize = 32 * 1024 * 1024;

pub(crate) fn check_report(elf: &Elf<'_>) -> Result<Budget> {
    let records = elf.section_headers.len()
        + elf.program_headers.len()
        + elf.syms.len()
        + elf.dynsyms.len()
        + elf.libraries.len()
        + elf.rpaths.len()
        + elf.runpaths.len();
    if records > MAX_RECORDS {
        return Err(Error::Malformed(
            "ELF preview exceeds the 250,000 record limit".into(),
        ));
    }
    let strings = elf
        .section_headers
        .iter()
        .map(|section| elf.shdr_strtab.get_at(section.sh_name).unwrap_or(""))
        .chain(
            elf.syms
                .iter()
                .map(|symbol| elf.strtab.get_at(symbol.st_name).unwrap_or("")),
        )
        .chain(
            elf.dynsyms
                .iter()
                .map(|symbol| elf.dynstrtab.get_at(symbol.st_name).unwrap_or("")),
        )
        .chain(elf.libraries.iter().copied())
        .chain(elf.rpaths.iter().copied())
        .chain(elf.runpaths.iter().copied())
        .chain(elf.interpreter)
        .chain(elf.soname);
    let mut remaining = MAX_TEXT_BYTES;
    for string in strings {
        remaining = remaining
            .checked_sub(string.len())
            .ok_or_else(|| Error::Malformed("ELF preview exceeds the 32 MiB text limit".into()))?;
    }
    Ok(Budget { records, remaining })
}

#[derive(Debug)]
pub(crate) struct Budget {
    records: usize,
    remaining: usize,
}
impl Budget {
    pub(crate) fn remaining_text(&self) -> usize {
        self.remaining
    }
    pub(crate) fn optional_text(&mut self, bytes: usize) -> bool {
        let Some(remaining) = self.remaining.checked_sub(bytes) else {
            return false;
        };
        self.remaining = remaining;
        true
    }
    pub(crate) fn relocation(&mut self, strings: &[&str]) -> Result<()> {
        self.records += 1;
        if self.records > MAX_RECORDS {
            return Err(Error::Malformed(
                "ELF preview exceeds the 250,000 record limit".into(),
            ));
        }
        for string in strings {
            self.remaining = self.remaining.checked_sub(string.len()).ok_or_else(|| {
                Error::Malformed("ELF preview exceeds the 32 MiB text limit".into())
            })?;
        }
        Ok(())
    }
}
